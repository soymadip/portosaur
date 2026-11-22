import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  State,
  Trace,
  TransportKind,
} from "vscode-languageclient/node";
import type {
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import { ensureServer } from "./download.ts";
import { PreviewManager } from "./preview.ts";

type TraceLevel = "off" | "messages" | "verbose";

let client: LanguageClient | undefined;
let starting = false;
let restartTimer: ReturnType<typeof setTimeout> | undefined;
let preview: PreviewManager | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let stateSubscription: vscode.Disposable | undefined;
// The client state and the binary it spawned, for the server menu.
let clientState: State | undefined;
let serverCommand: string | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // If the workspace already holds a Portosaur project, start
  // now. Otherwise watch for one appearing later (a fresh
  // `porto init` in an open folder, or a folder opened later).
  if (await hasPortosaurProject()) {
    await startClient(context);
  }
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/porto.{yml,yaml}",
  );
  watcher.onDidCreate(() => void startClient(context));
  context.subscriptions.push(watcher);
  context.subscriptions.push(
    vscode.commands.registerCommand("portosaur.restartServer", () => {
      void restartClient(context);
    }),
    vscode.commands.registerCommand("portosaur.showServerStatus", () => {
      void showServerStatus(context);
    }),
    vscode.commands.registerCommand("portosaur.selectServer", () => {
      void pickServerPath();
    }),
    vscode.commands.registerCommand("portosaur.preview", () => {
      void previewManager().showPreview();
    }),
    vscode.commands.registerCommand("portosaur.stopPreviewServer", () => {
      previewManager().stopServer();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      previewManager().followActiveEditor(editor);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void startClient(context);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("portosaur.server.path")) {
        // Typing a path fires this on every keystroke: wait
        // until the user stops typing before restarting.
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => void restartClient(context), 500);
      } else if (event.affectsConfiguration("portosaur.trace.server")) {
        void client?.setTrace(Trace.fromString(traceLevel()));
      }
    }),
  );
}

export async function deactivate(): Promise<void> {
  clearTimeout(restartTimer);
  preview?.dispose();
  preview = undefined;
  stateSubscription?.dispose();
  stateSubscription = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
  // A client whose start failed is not running: stopping it
  // throws.
  if (client?.needsStop()) {
    await client.stop();
  }
  client = undefined;
  clientState = undefined;
}

// previewManager is the one preview panel and dev server, created
// on first use.
function previewManager(): PreviewManager {
  if (!preview) {
    preview = new PreviewManager();
  }
  return preview;
}

// hasPortosaurProject checks the whole workspace (a glob, not
// just the root — the site may live in a docs/ or wiki/
// subdirectory) for a config file, or a package.json depending
// on the Portosaur packages.
async function hasPortosaurProject(): Promise<boolean> {
  const configs = await vscode.workspace.findFiles(
    "**/porto.{yml,yaml}",
    "**/node_modules/**",
    1,
  );
  if (configs.length > 0) {
    return true;
  }
  const manifests = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );
  for (const manifest of manifests) {
    try {
      const text = await vscode.workspace.fs.readFile(manifest);
      const pkg = JSON.parse(Buffer.from(text).toString("utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["@portosaur/cli"] ?? deps["@portosaur/core"]) {
        return true;
      }
    } catch {
      // An unreadable package.json is not a project.
    }
  }
  return false;
}

function traceLevel(): TraceLevel {
  const value = vscode.workspace
    .getConfiguration("portosaur")
    .get<string>("trace.server", "off");
  return value === "messages" || value === "verbose" ? value : "off";
}

function serverPathSetting(): string | undefined {
  const value = vscode.workspace
    .getConfiguration("portosaur")
    .get<string | null>("server.path");
  if (!value) {
    return undefined;
  }
  return expandHome(value);
}

// expandHome resolves a leading ~/ to the user's home directory.
function expandHome(value: string): string {
  return value.startsWith("~/")
    ? path.join(os.homedir(), value.slice(2))
    : value;
}

async function startClient(context: vscode.ExtensionContext): Promise<void> {
  if (client ?? starting) {
    return;
  }
  if (!(await hasPortosaurProject())) {
    return;
  }
  starting = true;
  try {
    const serverPath = serverPathSetting();
    const command = serverPath
      ? await resolveLocalServer(serverPath)
      : await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Portosaur: downloading the language server",
            cancellable: false,
          },
          async (progress) => {
            return ensureServer(context, (received, total) => {
              if (total > 0) {
                progress.report({
                  message: `${Math.round((received / total) * 100)}%`,
                });
              }
            });
          },
        );
    const serverOptions: ServerOptions = {
      command,
      args: ["--stdio"],
      transport: TransportKind.stdio,
    };
    serverCommand = command;
    const clientOptions: LanguageClientOptions = {
      // MDX files only. porto.yml is left to the YAML extension,
      // which reads the $schema line at the top of the file.
      documentSelector: [
        { scheme: "file", language: "mdx" },
        { scheme: "untitled", language: "mdx" },
      ],
    };
    client = new LanguageClient(
      "portosaur",
      "Portosaur Language Server",
      serverOptions,
      clientOptions,
    );
    showStatusBarItem(context);
    setClientState(State.Starting);
    stateSubscription = client.onDidChangeState((event) => {
      setClientState(event.newState);
    });
    await client.setTrace(Trace.fromString(traceLevel()));
    await client.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `Portosaur: the language server could not start. ${message}`,
    );
  } finally {
    starting = false;
  }
}

async function restartClient(context: vscode.ExtensionContext): Promise<void> {
  if (client?.needsStop()) {
    await client.stop();
  }
  stateSubscription?.dispose();
  stateSubscription = undefined;
  client = undefined;
  clientState = undefined;
  await startClient(context);
}

// showStatusBarItem creates the server status item on first use
// and shows it. The item appears only once a Portosaur project
// has started the client, and lives until deactivate.
function showStatusBarItem(context: vscode.ExtensionContext): void {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    statusBarItem.command = "portosaur.showServerStatus";
    context.subscriptions.push(statusBarItem);
  }
  statusBarItem.show();
}

// setClientState records the client state for the server menu
// and redraws the status bar item.
function setClientState(state: State): void {
  clientState = state;
  updateStatusBarItem(state);
}

// updateStatusBarItem redraws the status item for a client state.
function updateStatusBarItem(state: State): void {
  if (!statusBarItem) {
    return;
  }
  switch (state) {
    case State.Running:
      statusBarItem.text = "$(check) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server is running. Click for status.";
      break;
    case State.Starting:
      statusBarItem.text = "$(sync~spin) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server is starting… Click for status.";
      break;
    case State.StartFailed:
      statusBarItem.text = "$(error) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server could not start. Click for status.";
      break;
    case State.Stopped:
      statusBarItem.text = "$(error) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server is stopped. Click for status.";
      break;
  }
}

// A row of the server menu, carrying what picking it does.
type ServerMenuItem = vscode.QuickPickItem & {
  action: "none" | "path" | "restart";
};

// showServerStatus opens the server menu: the status, the
// server version when known, the binary path, and a restart
// row. With no client yet the status reads Not started and the
// path row still opens the picker.
async function showServerStatus(
  context: vscode.ExtensionContext,
): Promise<void> {
  const items: ServerMenuItem[] = [{ label: statusRowLabel(), action: "none" }];
  const version = client?.initializeResult?.serverInfo?.version;
  if (version) {
    items.push({ label: `$(tag) Version: ${version}`, action: "none" });
  }
  if (clientState === State.Running) {
    const memory = await serverMemory();
    if (memory !== undefined) {
      items.push({
        label: `$(database) Memory: ${formatBytes(memory)}`,
        action: "none",
      });
    }
  }
  const effectivePath =
    serverCommand ?? serverPathSetting() ?? "(downloaded automatically)";
  items.push({
    label: `$(file) Path: ${effectivePath}`,
    description: "Click to change",
    action: "path",
  });
  items.push({ label: "$(refresh) Restart server", action: "restart" });
  const picked = await vscode.window.showQuickPick(items, {
    title: "Portosaur Language Server",
    placeHolder: "Server status",
  });
  if (!picked) {
    return;
  }
  if (picked.action === "path") {
    await pickServerPath();
  } else if (picked.action === "restart") {
    await restartClient(context);
  }
}

// serverMemory asks the running server how much RAM it uses.
// Older servers do not know the request and answer
// method-not-found, and a slow answer times out after a
// second: either way there is simply no memory row.
async function serverMemory(): Promise<number | undefined> {
  const running = client;
  if (!running) {
    return undefined;
  }
  try {
    const stats = await Promise.race([
      // The empty params object is required: the server's
      // protocol handler decodes params before routing, and a
      // request with no params field fails that decode.
      running.sendRequest<{ memoryBytes: number }>("portosaur/serverStats", {}),
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), 1000),
      ),
    ]);
    const bytes = stats?.memoryBytes;
    return typeof bytes === "number" ? bytes : undefined;
  } catch {
    return undefined;
  }
}

// formatBytes renders a byte count for the menu: MB with one
// decimal, KB when under a megabyte.
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// statusRowLabel is the menu's status row, mirroring the status
// bar's four states.
function statusRowLabel(): string {
  switch (clientState) {
    case State.Running:
      return "$(check) Status: Running";
    case State.Starting:
      return "$(sync~spin) Status: Starting";
    case State.StartFailed:
      return "$(error) Status: Failed";
    case State.Stopped:
      return "$(error) Status: Stopped";
    default:
      return "$(circle-slash) Server: Not started";
  }
}

// A row of the path picker, carrying how the path is chosen.
type PathPickerItem = vscode.QuickPickItem & {
  method: "file" | "typed";
};

// pickServerPath lets the user choose a server binary from a
// file dialog or type a path, then saves it to the global
// portosaur.server.path setting. The configuration watcher
// restarts the client on the change, so nothing here restarts
// it. A path that does not exist, or a folder, is refused.
async function pickServerPath(): Promise<void> {
  const choice = await vscode.window.showQuickPick<PathPickerItem>(
    [
      { label: "Choose a file…", method: "file" },
      { label: "Type a path…", method: "typed" },
    ],
    {
      title: "Portosaur Server Path",
      placeHolder: "How to pick the server binary",
    },
  );
  if (!choice) {
    return;
  }
  let picked: string | undefined;
  if (choice.method === "file") {
    const files = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
    });
    picked = files?.[0]?.fsPath;
  } else {
    picked = await vscode.window.showInputBox({
      title: "Portosaur Server Path",
      prompt: "Path to the porto-lsp binary",
      value: serverPathSetting() ?? serverCommand ?? "",
    });
  }
  if (!picked) {
    return;
  }
  let stat;
  try {
    stat = await fs.stat(expandHome(picked));
  } catch {
    void vscode.window.showErrorMessage(
      `Portosaur: no file at that path: ${picked}`,
    );
    return;
  }
  if (stat.isDirectory()) {
    void vscode.window.showErrorMessage(
      `Portosaur: that path is a folder, not the server file: ${picked}`,
    );
    return;
  }
  await vscode.workspace
    .getConfiguration("portosaur")
    .update("server.path", picked, vscode.ConfigurationTarget.Global);
}

// resolveLocalServer checks a user-provided server path before
// the client spawns it: a missing file or a folder gets a clear
// error instead of a spawn failure, and a downloaded binary gets
// its executable bit back (browsers strip it on download).
async function resolveLocalServer(serverPath: string): Promise<string> {
  let stat;
  try {
    stat = await fs.stat(serverPath);
  } catch {
    throw new Error(
      `portosaur.server.path points to a file that does not exist: ${serverPath}`,
    );
  }
  if (stat.isDirectory()) {
    throw new Error(
      `portosaur.server.path points to a folder, not the server file: ${serverPath}`,
    );
  }
  if (process.platform !== "win32") {
    // A failed chmod is not fatal: the spawn below reports the
    // real problem if the file still cannot run.
    await fs.chmod(serverPath, 0o755).catch(() => undefined);
  }
  return serverPath;
}
