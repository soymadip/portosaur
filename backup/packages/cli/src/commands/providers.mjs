import { readFileSync } from "fs";
import { load } from "js-yaml";
import { colors } from "@portosaur/logger";
import { Paths } from "../utils/index.mjs";

/**
 * Displays available VCS providers and hosting platforms.
 */
export async function providersCommand(subcommand = null) {
  const registry = load(readFileSync(Paths.registry, "utf8"));

  const vcsProviders = registry.vcs_providers || {};
  const hostingPlatforms = registry.hosting_platforms || {};

  switch (subcommand) {
    case "vcs":
      displayVcsProviders(vcsProviders);
      break;

    case "hosting":
      displayHostingPlatforms(hostingPlatforms, vcsProviders);
      break;

    default:
      displayAll(vcsProviders, hostingPlatforms);
  }
}

/**
 * Format template variables for display (e.g., {{user}} -> <username>).
 */
function formatTemplateVars(str) {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, "<$1>");
}

/**
 * Strip ANSI color codes to get the actual display width.
 */
function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Create a simple ASCII table.
 */
function createTable(rows, columns) {
  const colWidths = columns.map((col) => col.length);

  for (const row of rows) {
    for (let i = 0; i < columns.length; i++) {
      const val = stripAnsi(row[i] || "");
      colWidths[i] = Math.max(colWidths[i], val.length);
    }
  }

  const lines = [];

  // Header
  const headerLine = columns
    .map((col, i) => colors.bold(col.padEnd(colWidths[i])))
    .join("  ");
  lines.push(headerLine);

  // Separator
  const sepLine = colWidths.map((w) => "─".repeat(w)).join("──");
  lines.push(colors.dim(sepLine));

  // Rows
  for (const row of rows) {
    const line = row
      .map((val, i) => {
        const plain = stripAnsi(val || "");
        const padded = plain.padEnd(colWidths[i]);
        // If the value is colored, we need to apply color to the padded version
        const colored = val || "";
        if (stripAnsi(colored) !== colored) {
          // Has color codes - reapply coloring after padding
          const colorCodes = colored.match(/\x1b\[[0-9;]*m/g) || [];
          const resetCode = "\x1b[0m";
          return colored + resetCode + padded.slice(plain.length);
        }
        return padded;
      })
      .join("  ");
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Display all providers and platforms.
 */
function displayAll(vcsProviders, hostingPlatforms) {
  console.log("📦 " + colors.bold("Available Providers"));
  console.log("");

  displayVcsProviders(vcsProviders);
  console.log("");

  displayHostingPlatforms(hostingPlatforms, vcsProviders);
}

/**
 * Display VCS providers.
 */
function displayVcsProviders(vcsProviders) {
  console.log(colors.bold("VCS Providers:"));
  console.log("");

  const rows = Object.entries(vcsProviders).map(([id, config]) => [
    colors.cyan(id),
    config.name || "N/A",
    config.domain || "N/A",
    config.default_hosting || "N/A",
  ]);

  console.log(createTable(rows, ["ID", "Name", "Domain", "Default Hosting"]));
}

/**
 * Display hosting platforms with supported providers.
 */
function displayHostingPlatforms(hostingPlatforms, vcsProviders) {
  console.log(colors.bold("Hosting Platforms:"));
  console.log("");

  const rows = Object.entries(hostingPlatforms).map(([id, config]) => {
    const supportedProviders = getSupportedProviders(config, vcsProviders);
    const idealName = config.repo?.ideal_name
      ? formatTemplateVars(config.repo.ideal_name)
      : "N/A";

    return [
      colors.cyan(id),
      config.name,
      config.domain || "N/A",
      supportedProviders.join(", "),
      idealName,
    ];
  });

  console.log(
    createTable(rows, [
      "ID",
      "Name",
      "Domain",
      "Supported Providers",
      "Ideal Repo Name",
    ]),
  );
}

/**
 * Get supported providers for a hosting platform.
 */
function getSupportedProviders(platform, vcsProviders) {
  const supportedProviders = platform.supported_providers;

  if (Array.isArray(supportedProviders)) {
    return supportedProviders;
  }

  if (supportedProviders === "all") {
    return Object.keys(vcsProviders);
  }

  return ["none"];
}
