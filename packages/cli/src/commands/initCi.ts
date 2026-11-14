import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import { runWizard, cancel } from "@portosaur/wizard";

import { logger, colors } from "../logger/index.ts";
import { mirrorSync, porto } from "../engine/index.ts";
import {
  Paths,
  detectVcsProvider,
  getGitConfig,
  getWorkflowMarkers,
  resolvePlatformKey,
  getPlatformUserGuess,
  validateProject,
  printWorkflowTips,
  warnIfRepoNameMismatch,
  isInteractive as getInteractivity,
} from "../utils/index.ts";

export interface InitCiOptions {
  /** Hosting Platform ID */
  hosting?: string;
}

/**
 * Initializes CI/CD configuration for an existing Portosaur project.
 */
export async function initCiCommand(
  options: InitCiOptions = {},
): Promise<void> {
  //
  //====================== Constants ======================

  const projectDir = process.cwd();

  const registry: any = load(fs.readFileSync(Paths.registry, "utf8"));

  const gitConfig = getGitConfig();
  const vcsProviderId = detectVcsProvider(registry);

  const isInteractive = getInteractivity(options);

  // Validate project existence
  try {
    validateProject(projectDir);
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }

  // Detect existing CI configurations based on workflow templates
  const ciMarkers = getWorkflowMarkers(registry);
  const detectedMarkers = ciMarkers.filter((marker) =>
    fs.existsSync(path.join(projectDir, marker)),
  );

  let state: { hostingPlatform: string | null; overwrite?: boolean } = {
    hostingPlatform: options.hosting || null,
  };

  /*
   * ====================== Interactive mode ======================
   */
  if (isInteractive) {
    const vcs = registry.vcs_providers[vcsProviderId as string];

    // Step labels match their ids: the wizard displays `label || id`, so
    // this keeps the history/error output exactly as before.
    const wizardState = await runWizard({
      initialState: state,

      intro: "Setting up Portosaur CI/CD",
      outro: false,

      steps: [
        {
          id: "overwrite",
          label: "overwrite",
          type: "confirm",
          prompt: "Existing CI configuration detected. Overwrite?",
          hint: `Detected: ${detectedMarkers.join(", ")}`,
          runIf: () => detectedMarkers.length > 0,
          initialValue: false,
        },
        {
          id: "hostingPlatform",
          label: "hostingPlatform",
          type: "select",
          prompt: "Select target hosting platform",
          hint: "The service where your portfolio will be deployed",
          options: Object.keys(registry.hosting_platforms).map((key) => ({
            value: key,
            label: registry.hosting_platforms[key].name,
            hint: key === vcs?.default_hosting ? "recommended" : "",
          })),
          initialValue: () => vcs?.default_hosting || "none",
        },
        {
          id: "confirm",
          label: "confirm",
          type: "confirm",
          prompt: "Are you sure you want to proceed?",
          hint: (state) =>
            state.overwrite
              ? "This will DELETE existing CI files and create new ones"
              : "This will create CI configuration files",
          initialValue: true,
        },
      ],
    });

    if (
      !wizardState.confirm ||
      (detectedMarkers.length > 0 && wizardState.overwrite === false)
    ) {
      cancel("Setup cancelled.");
      process.exit(0);
    }

    state = { ...state, ...wizardState };

    /*
     * ====================== Non-Interactive Mode ======================
     */
  } else {
    //
    // Normalize hosting platform
    if (state.hostingPlatform && state.hostingPlatform !== "none") {
      state.hostingPlatform =
        resolvePlatformKey(registry.hosting_platforms, state.hostingPlatform) ||
        state.hostingPlatform;
    }

    const vcs = registry.vcs_providers[vcsProviderId as string];

    state.hostingPlatform =
      state.hostingPlatform || vcs?.default_hosting || "none";

    if (state.hostingPlatform !== "none") {
      logger.info(
        `Detected ${vcs?.name || vcsProviderId} provider, defaulting to ${state.hostingPlatform}.`,
      );
    }
  }

  /*
   * ====================== Execution ======================
   */

  // Final canonical resolution
  const resolved = resolvePlatformKey(
    registry.hosting_platforms,
    state.hostingPlatform,
  );

  if (!resolved || resolved === "none") {
    logger.error(
      `Unknown or invalid hosting platform: ${state.hostingPlatform || "none"}`,
    );
    process.exit(1);
  }

  state.hostingPlatform = resolved;

  //--------- Clear the console ----------------
  logger.resetView();
  logger.info.box("Portosaur CI/CD Setup", {
    title: ` v${porto.version} `,
  });

  // Gather variables for template replacement
  const portoVer = porto.version || "0.0.0";

  const userName = getPlatformUserGuess(vcsProviderId, gitConfig) || "user";
  const fullName = gitConfig["user.name"] || "User";

  const templateVars = {
    projectName: path.basename(projectDir),
    repo_name: path.basename(projectDir),
    userName,
    fullName,
    portoVer,
  };

  const hConfig = registry.hosting_platforms[state.hostingPlatform];

  logger.info(`Configuring CI/CD for ${hConfig.name}...`);

  try {
    let template = hConfig.template_dir;
    if (typeof template === "object") {
      template =
        template[vcsProviderId as string] || Object.values(template)[0];
    }

    const workflowTemplateDir = path.join(Paths.workflows, template);

    if (!fs.existsSync(workflowTemplateDir)) {
      throw new Error(
        `Platform template for "${state.hostingPlatform}" not found.`,
      );
    }

    // Clean up existing CI files if requested
    if (state.overwrite) {
      logger.info("Cleaning up existing CI configuration...");

      for (const marker of detectedMarkers) {
        const fullPath = path.join(projectDir, marker);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }
    }

    mirrorSync(workflowTemplateDir, projectDir, templateVars, []);

    /*
     * ====================== Final Output ======================
     */

    logger.resetView();
    logger.success.box(`CI/CD successfully configured!`);

    printWorkflowTips(
      registry.hosting_platforms,
      state.hostingPlatform,
      logger,
      templateVars,
    );

    logger.newLine();
  } catch (error) {
    logger.error(`Configuration failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
