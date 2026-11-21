import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  Trace,
  TransportKind,
} from "vscode-languageclient/node";
import type {
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import { ensureServer } from "./download.ts";

type TraceLevel = "off" | "messages" | "verbose";

let client: LanguageClient | undefined;
let starting = false;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // If the workspace already holds a Portosaur project, start
  // now. Otherwise watch for one appearing later (a fresh
  // `porto init` in an open folder, or a folder opened later).
  if (await hasPortosaurProject()) {
    await startClient(context);
  }
  const watcher = vscode.workspace.createFileSystemWatcher("**/porto.y?(a)ml");
  watcher.onDidCreate(() => void startClient(context));
  context.subscriptions.push(watcher);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void startClient(context);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("portosaur.server.path")) {
        void restartClient(context);
      } else if (event.affectsConfiguration("portosaur.trace.server")) {
        void client?.setTrace(Trace.fromString(traceLevel()));
      }
    }),
  );
}

export async function deactivate(): Promise<void> {
  // A client whose start failed is not running: stopping it
  // throws.
  if (client?.needsStop()) {
    await client.stop();
  }
  client = undefined;
}

// hasPortosaurProject checks the whole workspace (a glob, not
// just the root — the site may live in a docs/ or wiki/
// subdirectory) for a config file, or a package.json depending
// on the Portosaur packages.
async function hasPortosaurProject(): Promise<boolean> {
  const configs = await vscode.workspace.findFiles(
    "**/porto.y?(a)ml",
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
      ? serverPath
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
      // MDX files, plus porto.yml wherever it sits. Which
      // documents the server serves is its own per-document
      // decision; the selector only decides what reaches it.
      documentSelector: [
        { scheme: "file", language: "mdx" },
        { scheme: "untitled", language: "mdx" },
        { scheme: "file", pattern: "**/porto.y?(a)ml" },
      ],
    };
    client = new LanguageClient(
      "portosaur",
      "Portosaur Language Server",
      serverOptions,
      clientOptions,
    );
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
  client = undefined;
  await startClient(context);
}
