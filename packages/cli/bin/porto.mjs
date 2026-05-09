#!/usr/bin/env bun

import { Command, Argument } from "commander";
import { porto } from "@portosaur/core";
import { initCommand } from "../src/commands/init.mjs";
import { initCiCommand } from "../src/commands/initCi.mjs";
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
  .description("Initialize a new Portosaur project")
  .option("-p, --vcs-provider <id>", "VCS Provider ID")
  .option("-h, --hosting <id>", "Hosting Platform ID")
  .option("-u, --username <user>", "VCS username")
  .option("-n, --name <name>", "Full name for portfolio")
  .option("-P, --project-name <name>", "Project name")
  .option("-k, --no-install", "Skip dependency installation")
  .action((options) => initCommand(options));

program
  .command("init-ci")
  .description("Setup CI/CD workflows for an existing project")
  .option("-h, --hosting <id>", "Hosting Platform ID")
  .action((options) => initCiCommand(options));

program
  .command("providers")
  .description("List available VCS providers and hosting platforms")
  .addArgument(
    new Argument("[type]", "Filter list by type").choices(["vcs", "hosting"]),
  )
  .action((type) => providersCommand(type));

program
  .command("dev [siteDir] [extraArgs...]")
  .alias("start")
  .description("Start the development server")
  .allowUnknownOption()
  .action(devCommand);

program
  .command("build [siteDir] [extraArgs...]")
  .description("Build the static site")
  .allowUnknownOption()
  .action(buildCommand);

program
  .command("serve [siteDir] [extraArgs...]")
  .description("Serve the built static site locally")
  .allowUnknownOption()
  .action(serveCommand);

program
  .command("schema", { hidden: true })
  .description("Generate the config schema")
  .option("-c, --config <path>", "Path to the source file to scan")
  .option("-o, --output <path>", "Path to output the schema file")
  .action(schemaCommand);

program.parse();
