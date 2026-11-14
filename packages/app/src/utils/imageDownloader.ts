import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";

//  Cache & Utilities
function getCacheKey(url: string, remoteState?: string | null): string {
  const base = remoteState ? `${url}-${remoteState}` : url;
  return crypto.createHash("md5").update(base).digest("hex");
}

/**
 * Fetches the ETag and Last-Modified headers of a remote file using a HEAD request.
 *
 * @param url - The URL to fetch headers for.
 * @param redirectCount - Internal count for tracking redirects.
 * @returns A string representing the remote file state (e.g. "remote:etag:lastModified:size").
 */
export async function fetchRemoteFileState(
  url: string,
  redirectCount = 0,
): Promise<string> {
  if (redirectCount > 5) {
    return "remote:missing";
  }

  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.request(url, { method: "HEAD" }, (res) => {
      if (
        res.statusCode &&
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        const redirectUrl = new URL(
          res.headers.location as string,
          url,
        ).toString();
        res.resume();
        resolve(fetchRemoteFileState(redirectUrl, redirectCount + 1));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        resolve(`remote:error:${res.statusCode}`);
        return;
      }

      const etag = res.headers["etag"] || "no-etag";
      const lastModified = res.headers["last-modified"] || "no-last-modified";
      const size = res.headers["content-length"] || "unknown-size";

      res.resume();
      resolve(`remote:${etag}:${lastModified}:${size}`);
    });

    req.on("error", () => resolve("remote:missing"));
    req.end();
  });
}

export interface DownloadImageOptions {
  url: string;
  destDir: string;
  fileName: string;
  proxies?: string[];
  redirectCount?: number;
  cacheDir?: string;
  remoteState?: string | null;
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
}

/**
 * Downloads a remote image with fallback to proxies and caching support.
 *
 * @param options - Configuration options for the download.
 * @param options.url - The URL of the image to download.
 * @param options.destDir - The directory where the image should be saved.
 * @param options.fileName - The filename to save the image as.
 * @param options.proxies - Optional list of proxy URLs to try if the download fails.
 * @param options.redirectCount - Internal count to prevent infinite redirect loops.
 * @param options.cacheDir - Directory to use for caching downloaded raw images.
 * @param options.remoteState - Optional ETag/Last-Modified string used to build a robust cache key.
 * @param options.logger - Optional logger with info/warn methods (defaults to console).
 * @returns A promise that resolves to the absolute path of the downloaded image.
 */
export async function downloadImage({
  url,
  destDir,
  fileName,
  proxies = [],
  redirectCount = 0,
  cacheDir,
  remoteState = null,
  logger,
}: DownloadImageOptions): Promise<string> {
  const log = logger ?? console;

  if (!url) {
    throw new Error("downloadImage: 'url' is required");
  }
  if (!destDir) {
    throw new Error("downloadImage: 'destDir' is required");
  }
  if (!fileName) {
    throw new Error("downloadImage: 'fileName' is required");
  }

  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  // Create destination directory and resolve paths
  const destPath = path.join(destDir, fileName);

  fs.mkdirSync(destDir, { recursive: true });

  // Check cache first
  const forceDownload = process.env.PORTO_FORCE_DOWNLOAD === "1";

  if (cacheDir && !forceDownload) {
    const cacheKey = getCacheKey(url, remoteState);
    const cachedPath = path.join(cacheDir, `${cacheKey}-${fileName}`);

    if (fs.existsSync(cachedPath)) {
      log.info(`Using cached image (Key matched)`);
      fs.copyFileSync(cachedPath, destPath);
      return destPath;
    }
  }

  // Download the image with HTTP protocol
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        // Handle redirects
        if (
          response.statusCode &&
          [301, 302, 303, 307, 308].includes(response.statusCode) &&
          response.headers.location
        ) {
          const redirectUrl = new URL(
            response.headers.location as string,
            url,
          ).toString();

          log.info(
            `Following redirect (${response.statusCode}) to: ${redirectUrl}`,
          );

          response.resume();
          resolve(
            downloadImage({
              url: redirectUrl,
              destDir,
              fileName,
              proxies,
              redirectCount: redirectCount + 1,
              cacheDir,
              remoteState,
              logger,
            }),
          );

          return;
        }

        // Validate HTTP status
        if (response.statusCode !== 200) {
          response.resume();
          tryProxyFallback(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        // Validate content type
        const contentType = (response.headers["content-type"] || "") as string;

        if (!contentType.startsWith("image/") && !url.includes("raw=true")) {
          log.warn(`Expected image but got ${contentType} from ${url}`);
          response.resume();
          tryProxyFallback(new Error(`Invalid content type: ${contentType}`));
          return;
        }

        // Write file to disk
        const file = fs.createWriteStream(destPath);
        response.pipe(file);

        file.on("finish", () => {
          file.close((err) => {
            if (err) {
              reject(err);
              return;
            }

            // Cache the downloaded image
            if (cacheDir) {
              try {
                const cacheKey = getCacheKey(url, remoteState);
                const cachedPath = path.join(
                  cacheDir,
                  `${cacheKey}-${fileName}`,
                );
                fs.mkdirSync(cacheDir, { recursive: true });
                fs.copyFileSync(destPath, cachedPath);
              } catch {}
            }

            resolve(destPath);
          });
        });

        file.on("error", (err) => {
          fs.unlink(destPath, () => reject(err));
        });
      })
      .on("error", (err) => {
        tryProxyFallback(err);
      });

    // Handle proxy fallback when download fails
    function tryProxyFallback(originalError: Error): void {
      if (proxies.length > 0) {
        const nextProxy = proxies[0];
        const remainingProxies = proxies.slice(1);
        const proxyUrl = `${nextProxy}${encodeURIComponent(url)}`;

        log.info(
          `Download failed or invalid content. Retrying via proxy: ${nextProxy}`,
        );

        resolve(
          downloadImage({
            url: proxyUrl,
            destDir,
            fileName,
            proxies: remainingProxies,
            redirectCount,
            cacheDir,
            remoteState,
            logger,
          }),
        );
      } else {
        reject(originalError || new Error(`Failed to download image: ${url}`));
      }
    }
  });
}
