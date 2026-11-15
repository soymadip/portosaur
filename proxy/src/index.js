// List of domains allowed to USE this proxy.
// Leave empty [] to allow any domain, or add your site
const ALLOWED_ORIGINS = [
  "https://soymadip.github.io",
  "https://soymadip.is-a.dev",
  "http://localhost:3000", // Allow local development
];

// List of domains/IPs to explicitly block.
const BLOCKED_DESTINATIONS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",
];

// List of domains the proxy is allowed to FETCH FROM.
const ALLOWED_DESTINATIONS = []; // All

// Maximum file size to proxy in Megabytes (100MB is Cloudflare's limit)
const MAX_SIZE_MB = 100;

// How long the browser/CDN should cache the proxied file (in hours)
const CACHE_TTL_HOURS = 168; // 7 days

// List of allowed content types (e.g. ["image/"])
const ALLOWED_CONTENT_TYPES = []; // All

//----------------------------------------------------------------------------

export default {
  async fetch(request, _env, _ctx) {
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");

    // Check if the request is coming from an allowed domain
    const isAllowed = (val) => {
      if (ALLOWED_ORIGINS.length === 0) return true;
      if (!val) return false;
      return ALLOWED_ORIGINS.some((allowed) => val.startsWith(allowed));
    };

    if (!isAllowed(origin) && !isAllowed(referer)) {
      return new Response("Forbidden: Origin or Referer not allowed", {
        status: 403,
      });
    }

    // We only accept GET requests
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const targetUrlStr = url.searchParams.get("url");

    if (!targetUrlStr) {
      return new Response("Missing 'url' query parameter", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(decodeURIComponent(targetUrlStr));
    } catch {
      return new Response("Invalid target URL", { status: 400 });
    }

    // Basic SSRF Protection
    if (BLOCKED_DESTINATIONS.includes(targetUrl.hostname)) {
      return new Response(
        `Forbidden: Target URL is blocked: ${targetUrl.hostname}`,
        {
          status: 403,
        },
      );
    }

    // Destination validation
    if (
      ALLOWED_DESTINATIONS.length > 0 &&
      !ALLOWED_DESTINATIONS.some(
        (dest) =>
          targetUrl.hostname === dest ||
          targetUrl.hostname.endsWith("." + dest),
      )
    ) {
      return new Response(
        `Forbidden: Destination not allowed: ${targetUrl.hostname}`,
        {
          status: 403,
        },
      );
    }

    // Handle preflight CORS requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers":
            request.headers.get("Access-Control-Request-Headers") || "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    try {
      // Fetch the actual file
      const fetchResponse = await fetch(targetUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Portosaur/1.0",
        },
      });

      if (!fetchResponse.ok) {
        return new Response(
          `Target URL responded with ${fetchResponse.status}`,
          {
            status: fetchResponse.status,
          },
        );
      }

      const contentLength = fetchResponse.headers.get("content-length");
      const contentType = fetchResponse.headers.get("content-type");

      // ─── Validation ──────────────────────────────────────────

      if (
        contentLength &&
        parseInt(contentLength, 10) > MAX_SIZE_MB * 1024 * 1024
      ) {
        return new Response(`File too large (Max ${MAX_SIZE_MB}MB)`, {
          status: 413,
        });
      }

      if (
        ALLOWED_CONTENT_TYPES.length > 0 &&
        (!contentType ||
          !ALLOWED_CONTENT_TYPES.some((type) => contentType.startsWith(type)))
      ) {
        return new Response(`Content type not allowed: ${contentType}`, {
          status: 415,
        });
      }

      // Stream the response back exactly as is
      const responseHeaders = new Headers(fetchResponse.headers);

      // Inject our CORS override headers!
      responseHeaders.set("Access-Control-Allow-Origin", origin || "*");
      responseHeaders.set("Access-Control-Expose-Headers", "*");

      // Cache settings
      if (CACHE_TTL_HOURS > 0) {
        const cacheSeconds = CACHE_TTL_HOURS * 3600;
        responseHeaders.set(
          "Cache-Control",
          `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
        );
      }

      // Drop headers that might cause security issues if mirrored verbatim
      responseHeaders.delete("content-security-policy");
      responseHeaders.delete("x-frame-options");

      return new Response(fetchResponse.body, {
        status: fetchResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { status: 500 });
    }
  },
};
