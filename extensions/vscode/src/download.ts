import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import * as vscode from "vscode";

const repo = "soymadip/portosaur";

// The release asset names, matching the GoReleaser build in
// packages/lsp: bare binaries, one per platform, plus
// checksums.txt. The extension version equals the server version
// it downloads: extension 0.1.0 fetches the lsp-v0.1.0 release.
export function assetName(): string | undefined {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin" && arch === "arm64") {
    return "porto-lsp_darwin_arm64";
  }
  if (platform === "darwin" && arch === "x64") {
    return "porto-lsp_darwin_amd64";
  }
  if (platform === "linux" && arch === "x64") {
    return "porto-lsp_linux_amd64";
  }
  if (platform === "linux" && arch === "arm64") {
    return "porto-lsp_linux_arm64";
  }
  if (platform === "win32" && arch === "x64") {
    return "porto-lsp_windows_amd64.exe";
  }
  return undefined;
}

function releaseURL(version: string, file: string): string {
  return `https://github.com/${repo}/releases/download/lsp-v${version}/${file}`;
}

// download fetches a URL to a file, following redirects (GitHub
// release downloads redirect to object storage).
async function download(
  url: string,
  dest: string,
  onProgress?: (received: number, total: number) => void,
  redirects = 0,
): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          if (redirects >= 5) {
            reject(new Error(`too many redirects downloading ${url}`));
            return;
          }
          void download(
            response.headers.location,
            dest,
            onProgress,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          reject(new Error(`downloading ${url} failed with HTTP ${status}`));
          return;
        }
        const total = Number(response.headers["content-length"] ?? 0);
        let received = 0;
        const file = fs.createWriteStream(dest);
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          onProgress?.(received, total);
        });
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (error) => {
          fs.unlink(dest, () => undefined);
          reject(error);
        });
        response.on("error", (error) => {
          fs.unlink(dest, () => undefined);
          reject(error);
        });
      })
      .on("error", reject);
  });
}

async function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// expectedChecksum reads the SHA-256 for the asset out of a
// GoReleaser checksums.txt ("<hash>  <filename>" per line).
function expectedChecksum(
  checksums: string,
  asset: string,
): string | undefined {
  for (const line of checksums.split("\n")) {
    const [hash, file] = line.trim().split(/\s+/);
    if (file === asset) {
      return hash;
    }
  }
  return undefined;
}

// ensureServer returns the path to a verified porto-lsp binary
// for this extension version, downloading it on first use. The
// binary is cached under the extension's global storage, one
// directory per version, and its checksum is verified on every
// start.
export async function ensureServer(
  context: vscode.ExtensionContext,
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  const asset = assetName();
  if (!asset) {
    throw new Error(
      `Portosaur: no porto-lsp binary for ${process.platform} ${process.arch}. ` +
        `Set portosaur.server.path to a local build.`,
    );
  }
  const version = context.extension.packageJSON.version as string;
  const dir = path.join(context.globalStorageUri.fsPath, version);
  const binary = path.join(dir, asset);
  const checksumsFile = path.join(dir, "checksums.txt");
  await fs.promises.mkdir(dir, { recursive: true });

  // A cached binary is only trusted when its checksum matches
  // the release's checksums.txt.
  if (fs.existsSync(binary) && fs.existsSync(checksumsFile)) {
    const expected = expectedChecksum(
      await fs.promises.readFile(checksumsFile, "utf8"),
      asset,
    );
    if (expected && (await sha256(binary)) === expected) {
      return binary;
    }
    // A stale or corrupt cache: fall through and re-download.
  }

  const tmp = `${binary}.download`;
  await download(releaseURL(version, asset), tmp, onProgress);
  await download(releaseURL(version, "checksums.txt"), checksumsFile);
  const expected = expectedChecksum(
    await fs.promises.readFile(checksumsFile, "utf8"),
    asset,
  );
  if (!expected) {
    await fs.promises.unlink(tmp).catch(() => undefined);
    throw new Error(`Portosaur: checksums.txt has no entry for ${asset}.`);
  }
  if ((await sha256(tmp)) !== expected) {
    await fs.promises.unlink(tmp).catch(() => undefined);
    throw new Error(
      `Portosaur: the downloaded ${asset} failed its checksum. Try again.`,
    );
  }
  await fs.promises.rename(tmp, binary);
  if (process.platform !== "win32") {
    await fs.promises.chmod(binary, 0o755);
  }
  // Old versions' binaries linger in storage; drop them.
  for (const entry of await fs.promises.readdir(
    context.globalStorageUri.fsPath,
    { withFileTypes: true },
  )) {
    if (entry.isDirectory() && entry.name !== version) {
      await fs.promises.rm(
        path.join(context.globalStorageUri.fsPath, entry.name),
        { recursive: true, force: true },
      );
    }
  }
  return binary;
}
