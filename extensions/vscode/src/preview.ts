import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as vscode from "vscode";

// The preview: a panel beside the editor showing the dev server's
// page for the open MDX file. The extension starts `porto dev`
// itself when nothing answers on the preview port yet, and reuses
// a server that is already running.

// Content directories and the route each one serves under.
const CONTENT_ROUTES: Record<string, string> = {
  docs: "docs",
  notes: "notes",
  blog: "blog",
};

const CONFIG_FILES = ["porto.yml", "porto.yaml"];

// Number prefixes stripped from file and directory names: `1 - x`,
// `4.1 - x`, `2. x`. Mirrors the site's NUMBER_PREFIX_PATTERN.
const NUMBER_PREFIX_PATTERN = /^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/;

// cleanSegment mirrors the site's slug cleaning: strip a number
// prefix, lowercase, and turn runs of other characters into dashes.
function cleanSegment(segment: string): string {
  const stripped = segment.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isIndexBase(base: string): boolean {
  const lower = base.toLowerCase();
  return lower === "index" || lower === "readme";
}

// posixResolve joins URL-style segments, normalizing `.` and `..`.
function posixResolve(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    for (const segment of part.split("/")) {
      if (segment === "" || segment === ".") {
        continue;
      }
      if (segment === "..") {
        out.pop();
      } else {
        out.push(segment);
      }
    }
  }
  return `/${out.join("/")}`;
}

// slugForContentPath mirrors the site's slug algorithm
// (guessDocPermalink) for the common cases: number prefixes are
// stripped, index files collapse to their folder, and a
// frontmatter slug on the page itself wins. Parent index files
// with their own custom slugs are not mirrored — their folders
// fall back to the cleaned folder name. Returns the slug with no
// leading slash, or "" for a content-root index.
export function slugForContentPath(
  contentRelativePath: string,
  frontmatterSlug?: string,
): string {
  const segments = contentRelativePath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  const filename = segments[segments.length - 1];
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const isIndexFile = isIndexBase(base);

  let currentRoutePath = "/";
  const dirLimit = isIndexFile ? segments.length - 2 : segments.length - 1;
  for (let i = 0; i < dirLimit; i++) {
    currentRoutePath = posixResolve(
      currentRoutePath,
      cleanSegment(segments[i]),
    );
  }

  let finalSlug: string;
  if (isIndexFile) {
    if (frontmatterSlug) {
      finalSlug = frontmatterSlug.startsWith("/")
        ? frontmatterSlug
        : posixResolve(currentRoutePath, frontmatterSlug);
    } else if (segments.length === 1) {
      finalSlug = currentRoutePath;
    } else {
      finalSlug = posixResolve(
        currentRoutePath,
        cleanSegment(segments[segments.length - 2]),
      );
    }
  } else if (frontmatterSlug) {
    finalSlug = frontmatterSlug.startsWith("/")
      ? frontmatterSlug
      : posixResolve(currentRoutePath, frontmatterSlug);
  } else {
    finalSlug = posixResolve(currentRoutePath, cleanSegment(base));
  }
  return finalSlug.replace(/^\//, "");
}

// readFrontmatterSlug reads the top-level `slug:` key from the
// file's frontmatter block, if it has one.
export function readFrontmatterSlug(filePath: string): string | undefined {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  const lines = text.split("\n");
  if (lines.length === 0 || lines[0].replace(/\r$/, "") !== "---") {
    return undefined;
  }
  for (const line of lines.slice(1)) {
    const trimmed = line.replace(/\r$/, "");
    if (trimmed === "---") {
      return undefined;
    }
    // Only a column-zero key counts: an indented slug belongs to a
    // nested object.
    const match = /^slug:\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/.exec(trimmed);
    if (match) {
      const value = match[1] ?? match[2] ?? match[3];
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

// readBaseUrl reads the site's base URL from porto.yml: the
// `base_url` key under `site:`. "auto" and a missing key both mean
// the site root in dev, so both return "/". Returns the path with
// a trailing slash.
export function readBaseUrl(projectRoot: string): string {
  for (const name of CONFIG_FILES) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(projectRoot, name), "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    let inSite = false;
    let siteIndent: number | undefined;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }
      if (/^site:\s*(#.*)?$/.test(line)) {
        inSite = true;
        siteIndent = undefined;
        continue;
      }
      if (/^\S/.test(line)) {
        inSite = false;
        siteIndent = undefined;
        continue;
      }
      if (!inSite) {
        continue;
      }
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (siteIndent === undefined) {
        siteIndent = indent;
      }
      // Only keys at the site block's own indent count: deeper
      // keys belong to nested objects.
      if (indent !== siteIndent) {
        continue;
      }
      const match =
        /^\s+base_url:\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*(#.*)?$/.exec(line);
      if (match) {
        const value = match[1] ?? match[2] ?? match[3];
        if (!value || value === "auto") {
          return "/";
        }
        return value.endsWith("/") ? value : `${value}/`;
      }
    }
    return "/";
  }
  return "/";
}

// pageUrlForFile maps an MDX file to the page URL the dev server
// serves it at, or null when the file is not a page (outside the
// docs, notes and blog directories, or not a Markdown file).
export function pageUrlForFile(
  filePath: string,
  projectRoot: string,
): string | null {
  if (!filePath.endsWith(".mdx") && !filePath.endsWith(".md")) {
    return null;
  }
  const relative = path.relative(projectRoot, filePath);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  const segments = relative.split(path.sep);
  const route = CONTENT_ROUTES[segments[0]];
  if (!route) {
    return null;
  }
  const contentPath = segments.slice(1).join("/");
  if (contentPath === "") {
    return null;
  }
  const slug = slugForContentPath(contentPath, readFrontmatterSlug(filePath));
  const base = readBaseUrl(projectRoot);
  const prefix = base === "/" ? "" : base.replace(/\/$/, "");
  const page = slug === "" ? `/${route}/` : `/${route}/${slug}/`;
  return `${prefix}${page}`;
}

// findProjectRoot walks up from the file looking for a Portosaur
// config file, stopping at the workspace folder that holds it.
export function findProjectRoot(filePath: string): string | undefined {
  let dir = path.dirname(filePath);
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  const stopAt = folder ? folder.uri.fsPath : path.parse(dir).root;
  while (true) {
    for (const name of CONFIG_FILES) {
      if (fs.existsSync(path.join(dir, name))) {
        return dir;
      }
    }
    if (dir === stopAt || path.dirname(dir) === dir) {
      return undefined;
    }
    dir = path.dirname(dir);
  }
}

function previewPort(): number {
  const value = vscode.workspace
    .getConfiguration("portosaur")
    .get<number>("preview.port", 3000);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return 3000;
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// isServing reports whether anything answers HTTP on the port. Any
// response counts, including a 404: the dev server answers every
// path, even ones with no page.
function isServing(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(
      { host: "localhost", port, path: "/", timeout: 2000 },
      (response) => {
        response.resume();
        resolve(true);
      },
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

// previewHtml is the panel's document: a full-size frame showing
// the dev server's page. The policy allows framing the dev origin
// and nothing else; the panel itself runs no scripts.
function previewHtml(pageUrl: string): string {
  const origin = new URL(pageUrl).origin;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline';">
<style>
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
iframe { display: block; width: 100%; height: 100%; border: none; }
</style>
</head>
<body>
<iframe src="${pageUrl}"></iframe>
</body>
</html>`;
}

export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private panelUrl: string | undefined;
  private panelProjectRoot: string | undefined;
  private child: childProcess.ChildProcess | undefined;
  private owned = false;
  private serverProjectRoot: string | undefined;
  private serverPort: number | undefined;
  private starting: Promise<void> | undefined;
  private output: vscode.OutputChannel | undefined;

  // Whether the dev server now running was started by this
  // extension (as opposed to one that was already running).
  get ownsServer(): boolean {
    return this.owned;
  }

  // The URL the panel is currently showing, if it is open.
  get currentUrl(): string | undefined {
    return this.panelUrl;
  }

  // showPreview opens the preview for the active MDX file,
  // starting the dev server first when nothing answers on the
  // preview port yet.
  async showPreview(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "mdx") {
      void vscode.window.showInformationMessage(
        "Portosaur: open an MDX file to preview it.",
      );
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const root = findProjectRoot(filePath);
    if (!root) {
      void vscode.window.showErrorMessage(
        "Portosaur: this file is not in a Portosaur project.",
      );
      return;
    }
    const page = pageUrlForFile(filePath, root);
    if (!page) {
      void vscode.window.showInformationMessage(
        "Portosaur: this file has no page to preview.",
      );
      return;
    }
    const port = previewPort();
    try {
      await this.ensureServer(root, port);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(
        `Portosaur: the dev server could not start. ${message}`,
      );
      this.outputChannel().show(true);
      return;
    }
    this.openPanel(`http://localhost:${port}${page}`, root);
  }

  // followActiveEditor moves the panel to the new file when it is
  // an MDX page in the same project the panel is showing. Files in
  // another project, and files with no page, leave it alone.
  followActiveEditor(editor: vscode.TextEditor | undefined): void {
    if (!this.panel || !this.panel.visible || !this.panelProjectRoot) {
      return;
    }
    if (!this.serverPort) {
      return;
    }
    if (!editor || editor.document.languageId !== "mdx") {
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const root = findProjectRoot(filePath);
    if (root !== this.panelProjectRoot) {
      return;
    }
    const page = pageUrlForFile(filePath, root);
    if (!page) {
      return;
    }
    const url = `http://localhost:${this.serverPort}${page}`;
    if (url !== this.panelUrl) {
      this.panelUrl = url;
      this.panel.webview.html = previewHtml(url);
    }
  }

  // stopServer stops the dev server, but only when this extension
  // started it. A server that was already running is left alone.
  stopServer(): void {
    if (!this.owned) {
      if (this.serverPort !== undefined) {
        void vscode.window.showInformationMessage(
          "Portosaur: the preview server was already running, so it was left alone.",
        );
      } else {
        void vscode.window.showInformationMessage(
          "Portosaur: no preview server is running.",
        );
      }
      return;
    }
    this.killChild();
  }

  dispose(): void {
    this.killChild();
    this.panel?.dispose();
    this.panel = undefined;
    this.panelUrl = undefined;
    this.panelProjectRoot = undefined;
    this.output?.dispose();
    this.output = undefined;
  }

  private openPanel(url: string, projectRoot: string): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "portosaurPreview",
        "Portosaur Preview",
        vscode.ViewColumn.Beside,
        { enableScripts: false, retainContextWhenHidden: true },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.panelUrl = undefined;
        this.panelProjectRoot = undefined;
      });
    }
    this.panelUrl = url;
    this.panelProjectRoot = projectRoot;
    this.panel.webview.html = previewHtml(url);
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  private async ensureServer(root: string, port: number): Promise<void> {
    if (this.serverPort === port && this.serverProjectRoot === root) {
      return;
    }
    if (this.starting) {
      await this.starting;
      if (this.serverPort === port && this.serverProjectRoot === root) {
        return;
      }
    }
    this.starting = this.startServer(root, port);
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async startServer(root: string, port: number): Promise<void> {
    // A different project on the same port: stop our own server
    // first. A server we did not start is never stopped.
    if (this.child && this.serverProjectRoot !== root) {
      if (!this.owned) {
        throw new Error(
          `the preview port ${port} is already in use by another project`,
        );
      }
      this.killChild();
    }
    if (await isServing(port)) {
      this.serverPort = port;
      this.serverProjectRoot = root;
      this.owned = false;
      return;
    }
    const portoBin = path.join(root, "node_modules", ".bin", "porto");
    if (!fs.existsSync(portoBin)) {
      throw new Error(
        "the project dependencies are not installed. Run bun install (or npm install) in the project first",
      );
    }
    const output = this.outputChannel();
    const child = childProcess.spawn(
      portoBin,
      ["dev", "--port", String(port), "--no-browser"],
      {
        cwd: root,
        shell: process.platform === "win32",
        env: { ...process.env },
      },
    );
    this.child = child;
    this.owned = true;
    this.serverProjectRoot = root;
    this.serverPort = port;
    child.stdout?.on("data", (chunk) => output.append(String(chunk)));
    child.stderr?.on("data", (chunk) => output.append(String(chunk)));
    child.on("exit", (code) => {
      if (this.child === child) {
        this.child = undefined;
        this.owned = false;
        this.serverProjectRoot = undefined;
        this.serverPort = undefined;
      }
      if (code !== 0 && code !== null) {
        output.appendLine(
          `Portosaur: the dev server stopped (exit code ${code}).`,
        );
      }
    });
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Portosaur: starting the dev server",
        cancellable: false,
      },
      () => this.waitForServer(port),
    );
  }

  private async waitForServer(port: number): Promise<void> {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (!this.child) {
        throw new Error(
          "the dev server stopped while starting. See the Portosaur Preview output for details",
        );
      }
      if (await isServing(port)) {
        return;
      }
      await sleep(500);
    }
    throw new Error(
      "the dev server did not answer in time. See the Portosaur Preview output for details",
    );
  }

  private killChild(): void {
    const child = this.child;
    this.child = undefined;
    this.owned = false;
    this.serverProjectRoot = undefined;
    this.serverPort = undefined;
    if (child && child.exitCode === null) {
      child.kill();
    }
  }

  private outputChannel(): vscode.OutputChannel {
    if (!this.output) {
      this.output = vscode.window.createOutputChannel("Portosaur Preview");
    }
    return this.output;
  }
}
