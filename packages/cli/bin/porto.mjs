#!/usr/bin/env bun

import { Command, Option } from "commander";
import { porto } from "@portosaur/core";
import { initCommand } from "../src/commands/init.mjs";
import { initCiCommand } from "../src/commands/initCi.mjs";
import { initIgnoreCommand } from "../src/commands/initIgnore.mjs";
import { devCommand } from "../src/commands/dev.mjs";
import { buildCommand } from "../src/commands/build.mjs";
import { serveCommand } from "../src/commands/serve.mjs";
import { schemaCommand } from "../src/commands/schema.mjs";
import { providersCommand } from "../src/commands/providers.mjs";

const program = new Command();

program
  .name("porto")
  .description("CLI for Portosaur — The complete portfolio solution")
  .version(porto.version, "-v, --version", "output the current version")
  .helpOption("--help", "output usage information");

program
  .command("init")
  .description(
    "Initialize a new Portosaur project (or only generate CI/ignore)",
  )
  .option("-p, --vcs-provider <id>", "VCS Provider ID")
  .option("-h, --hosting <id>", "Hosting Platform ID")
  .option("-u, --username <user>", "VCS username")
  .option("-n, --name <name>", "Full name for portfolio")
  .option("-P, --project-name <name>", "Project name")
  .option("-k, --no-install", "Skip dependency installation")
  .option("--ci-only", "Setup Only CI/CD workflows for an existing project")
  .option(
    "--gitignore-only",
    "Generate Only .gitignore file for an existing project",
  )
  .action((options) => {
    if (options.ciOnly) return initCiCommand(options);
    if (options.gitignoreOnly) return initIgnoreCommand(options);
    return initCommand(options);
  });

program
  .command("providers")
  .description("List available VCS providers and hosting platforms")
  .addArgument(
    new Argument("[type]", "Filter list by type").choices(["vcs", "hosting"]),
  )
  .action((type) => providersCommand(type));

program
  .command("dev [siteDir]")
  .alias("start")
  .description("Start the development server")
  .option("-p, --port <port>", "Port to use")
  .option("-h, --host <host>", "Host to use")
  .option("--no-browser", "Do not open browser")
  .option("--poll [interval]", "Use polling for file watching")
  .action((siteDir, options) => devCommand(siteDir, options));

program
  .command("build [siteDir]")
  .description("Build the static site")
  .option("-o, --out-dir <dir>", "Custom output directory")
  .option("--bundle-analyzer", "Analyze webpack bundle")
  .option("--no-minify", "Do not minify the output")
  .action((siteDir, options) => buildCommand(siteDir, options));

program
  .command("serve [siteDir]")
  .description("Serve the built static site locally")
  .option("-o, --out-dir <dir>", "Custom output directory")
  .option("-p, --port <port>", "Port to use")
  .option("-h, --host <host>", "Host to use")
  .option("--no-browser", "Do not open browser")
  .action((siteDir, options) => serveCommand(siteDir, options));

program
  .command("schema", { hidden: true })
  .description("Generate the config schema")
  .option("-c, --config <path>", "Path to the source file to scan")
  .option("-o, --output <path>", "Path to output the schema file")
  .action(schemaCommand);

program.parse();
