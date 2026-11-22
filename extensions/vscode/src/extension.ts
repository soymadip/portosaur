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
  // A leading ~/ is the user's home directory.
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
    updateStatusBarItem(State.Starting);
    stateSubscription = client.onDidChangeState((event) => {
      updateStatusBarItem(event.newState);
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
    statusBarItem.command = "portosaur.restartServer";
    context.subscriptions.push(statusBarItem);
  }
  statusBarItem.show();
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
        "Portosaur language server is running. Click to restart.";
      break;
    case State.Starting:
      statusBarItem.text = "$(sync~spin) Portosaur";
      statusBarItem.tooltip = "Portosaur language server is starting…";
      break;
    case State.StartFailed:
      statusBarItem.text = "$(error) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server could not start. Click to restart.";
      break;
    case State.Stopped:
      statusBarItem.text = "$(error) Portosaur";
      statusBarItem.tooltip =
        "Portosaur language server is stopped. Click to restart.";
      break;
  }
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
