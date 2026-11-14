import type { APIRoute } from "astro";
import config from "porto:config";

// Injected endpoint (`injectRoute`, pattern `/robots.txt`): renders the
// robots rules from the resolved site config at build time. Ported from
// the engine's `generateRobotsTxt` (D13) — the rendered content matches
// the old generator exactly.

function renderRobotsTxt(): string {
  const robots = config.site.robotsTxt;

  let content = `User-agent: *
`;
  if (robots.rules) {
    for (const rule of robots.rules) {
      if (rule.allow) {
        for (const p of [].concat(rule.allow)) {
          content += `Allow: ${p}
`;
        }
      }
      if (rule.disallow) {
        for (const p of [].concat(rule.disallow)) {
          content += `Disallow: ${p}
`;
        }
      }
    }
  }
  if (robots.customLines) {
    for (const line of robots.customLines) {
      content += `${line}
`;
    }
  }
  if (config.site.url) {
    content += `Sitemap: ${config.site.url}${config.site.baseUrl || "/"}sitemap.xml
`;
  }
  return content;
}

export const GET = (async () => {
  // The old generator returned early without writing a file when robots
  // generation was disabled; the endpoint equivalent is an empty 200
  // response (no rules served, no sitemap advertised).
  if (config.site.robotsTxt.enable === false) {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(renderRobotsTxt(), {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}) satisfies APIRoute;
