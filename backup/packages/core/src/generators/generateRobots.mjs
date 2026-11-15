import fs from "fs";
import path from "path";
import { logger } from "@portosaur/logger";
export function generateRobotsTxt(siteDir, options = {}) {
  if (options.enable === false) {
    return;
  }
  logger.info("Generating robots.txt...");

  const targetDir = options.outDir
    ? path.resolve(options.outDir)
    : path.resolve(siteDir, "static");

  const robotsPath = path.join(targetDir, "robots.txt");
  let content = `User-agent: *
`;
  if (options.rules) {
    for (const rule of options.rules) {
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
  if (options.customLines) {
    for (const line of options.customLines) {
      content += `${line}
`;
    }
  }
  if (options.siteUrl) {
    content += `Sitemap: ${options.siteUrl}${options.baseUrl || "/"}sitemap.xml
`;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(robotsPath, content);
  logger.success(`Generated robots.txt at ${robotsPath}`);
}
