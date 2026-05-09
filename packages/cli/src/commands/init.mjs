import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import os from "os";
import { execSync, execFileSync } from "child_process";
import yaml from "js-yaml";

import { runWizard, cancel } from "@portosaur/wizard";
import { logger, colors } from "@portosaur/logger";
import { mirrorSync, openInBrowser, hasCommand, porto } from "@portosaur/core";

import {
  Paths,
  getGitConfig,
  resolvePlatformKey,
  getPlatformUserGuess,
  getPackageManager,
  ensureContentDirs,
  printWorkflowTips,
  isInteractive as getInteractivity,
  looksLikeTestProject,
} from "../utils/index.mjs";

/**
 * Initializes a new Portosaur project.
 */
export async function initCommand(options = {}) {
  /*
   * ====================== Constants ======================
   */

  const registry = yaml.load(readFileSync(Paths.registry, "utf8"));

  const gitConfig = getGitConfig();
  const osUser = os.userInfo().username;

  const isInteractive = getInteractivity(options);

  let state = {
    vcs: null,
    hosting: null,
    userName: null,
    fullName: null,
    projectName: options.projectName || null,
    addRemote: false,
    gitRemoteUrl: null,
  };

  /*
   * ====================== Interactive mode ======================
   */
  if (isInteractive) {
    const wizardState = await runWizard({
      initialState: state,

      intro: `${colors.bold("Initializing new Portosaur Project")} (v${porto.version})`,
      outro: false,

      steps: [
        {
          id: "vcs",
          type: "select",
          prompt: "Choose Your VCS Provider",
          options: [
            ...Object.entries(registry.vcs_providers).map(([id, cfg]) => ({
              value: id,
              label: cfg.name,
            })),
            { value: "none", label: "Local only / Skip" },
          ],
        },
        {
          id: "hosting",
          type: "select",
          prompt: "Where do you want host your portfolio site?",
          hint: "Auto deployment (CI/CD) will be setup",
          runIf: (state) => state.vcs !== "none",
          options: (state) => {
            const vcsConfig = registry.vcs_providers[state.vcs];
            return [
              ...Object.entries(registry.hosting_platforms)
                .filter(([id, cfg]) => {
                  const supported = cfg.supported_providers || [];
                  const isAgnostic =
                    supported === "all" ||
                    (Array.isArray(supported) && supported.includes("all"));

                  const canProvideTemplate =
                    typeof cfg.template_dir === "string" ||
                    cfg.template_dir?.[state.vcs];

                  return (
                    (isAgnostic || supported.includes(state.vcs)) &&
                    canProvideTemplate
                  );
                })
                .map(([id, cfg]) => ({
                  value: id,
                  label: cfg.name,
                  hint: id === vcsConfig?.default_hosting ? "recommended" : "",
                })),

              // Skip Option
              { value: "none", label: "Manual / Setup later" },
            ];
          },
          initialValue: (state) =>
            registry.vcs_providers[state.vcs]?.default_hosting || "none",
        },
        {
          id: "userName",
          type: "text",
          required: true,
          prompt: (state) =>
            `Enter your ${registry.vcs_providers[state.vcs]?.name || state.vcs} username`,
          runIf: (state) => state.vcs !== "none",
          initialValue: (state) =>
            getPlatformUserGuess(state.vcs, gitConfig) || osUser,
          transform: (v) => v.trim(),
        },
        {
          id: "fullName",
          type: "text",
          required: true,
          prompt: "Enter your full name",
          hint: "Used for the site title etc..",
          runIf: () => !options.name,
          initialValue: () => gitConfig["user.name"] || osUser || "Your Name",
          transform: (v) => v.trim(),
        },
        {
          id: "projectNameType",
          type: "select",
          prompt: "Choose your project name",
          hint: (state) =>
            state.hosting !== "none" &&
            registry.hosting_platforms[state.hosting]?.repo?.ideal_name
              ? "We recommend sticking with the default name"
              : "The name of the directory/repository",
          runIf: (state) =>
            !state.projectName &&
            state.hosting !== "none" &&
            registry.hosting_platforms[state.hosting]?.repo?.ideal_name,
          options: (state) => {
            const hConfig = registry.hosting_platforms[state.hosting];
            const vcsConfig = registry.vcs_providers[state.vcs];
            const ideal = hConfig.repo.ideal_name
              .replace("{{user}}", state.userName)
              .replace("{{domain}}", vcsConfig.domain);
            return [
              { label: ideal, value: "ideal", hint: "recommended" },
              { label: "Custom Name", value: "custom" },
            ];
          },
        },
        {
          id: "confirmCustomName",
          type: "confirm",
          level: "warn",
          prompt: "Are you sure?",
          hint: "Custom names may break auto-deployments on some platforms",
          runIf: (state) =>
            state.projectNameType === "custom" && state.hosting !== "none",
          initialValue: false,
        },
        {
          id: "projectName",
          type: "text",
          required: true,
          level: (state) =>
            state.projectNameType === "custom" && state.hosting !== "none"
              ? "warn"
              : undefined,
          prompt: "Enter project name",
          hint: (state) =>
            state.projectNameType === "custom" && state.hosting !== "none"
              ? colors.warn("Warning! Custom names may break auto-deployments")
              : "The name of the directory/repository",
          runIf: (state) => {
            if (state.projectName) return false;
            if (state.hosting === "none") return true;
            if (state.projectNameType === "ideal") return false;
            if (state.projectNameType === "custom")
              return state.confirmCustomName;
            return true;
          },
          initialValue: (state) => {
            if (state.projectNameType === "ideal" && state.vcs !== "none") {
              const hConfig = registry.hosting_platforms[state.hosting];
              const vcsConfig = registry.vcs_providers[state.vcs];
              if (hConfig && vcsConfig) {
                return hConfig.repo.ideal_name
                  .replace("{{user}}", state.userName)
                  .replace("{{domain}}", vcsConfig.domain);
              }
            }
            return state.projectName || "my-portfolio";
          },
          transform: (v) => v.trim(),
        },
        {
          id: "openBrowser",
          type: "confirm",
          prompt: "Open browser to create the repository?",
          hint: "Redirects you to the 'New Repository' page on your Git host",
          runIf: (state) => state.vcs !== "none",
          initialValue: true,
          onResponse: (val, state) => {
            if (val && state.vcs !== "none") {
              const vcsConfig = registry.vcs_providers[state.vcs];
              const newRepoUrl = vcsConfig.new_url
                .replace("{{user}}", state.userName)
                .replace("{{projectName}}", state.projectName)
                .replace("{{domain}}", vcsConfig.domain);

              openInBrowser(newRepoUrl);
            }
          },
        },
        {
          id: "repoCreated",
          type: "pause",
          prompt:
            "Create the repository on your Git host, then press Enter to continue",
          runIf: (state) => {
            if (state.vcs === "none") return false;
            // If unset, show the pause (openBrowser prompt runs before this step)
            if (state.openBrowser === undefined) return true;
            // Accept boolean false and common string equivalents as "no"
            if (state.openBrowser === false) return false;
            const sval = String(state.openBrowser).toLowerCase();
            return !(sval === "false" || sval === "0" || sval === "no");
          },
        },
        {
          id: "gitRemoteUrl",
          type: "text",
          required: true,
          prompt: "Confirm git repository URL",
          hint: "Needed to link your local project to the remote repository",
          runIf: (state) => state.vcs !== "none",
          initialValue: (state) => {
            const vcsConfig = registry.vcs_providers[state.vcs];
            return vcsConfig.url
              .replace("{{user}}", state.userName)
              .replace("{{projectName}}", state.projectName)
              .replace("{{domain}}", vcsConfig.domain);
          },
          transform: (v) => v.trim(),
        },
        {
          id: "confirm",
          type: "confirm",
          prompt: "Are you sure you want to proceed?",
          hint: "Please review settings & confirm",
          initialValue: true,
        },
      ],
    });

    if (!wizardState.confirm) {
      cancel("Initialization cancelled.");
      process.exit(0);
    }

    state = { ...state, ...wizardState };

    /*
     * ====================== Non-Interactive Mode ======================
     */
  } else {
    //----------- Parse Flags -------------

    // Normalize vcs provider
    let vcsProvider = options.vcsProvider;
    if (vcsProvider && vcsProvider !== "none") {
      vcsProvider =
        Object.keys(registry.vcs_providers).find(
          (k) => k.toLowerCase() === vcsProvider.toLowerCase(),
        ) || vcsProvider;
    }

    let hosting = options.hosting;
    if (hosting && hosting !== "none") {
      hosting =
        resolvePlatformKey(registry.hosting_platforms, hosting) || hosting;
    }

    //--------- Set state values------------
    state.vcs = vcsProvider || Object.keys(registry.vcs_providers)[0];
    state.hosting =
      hosting || registry.vcs_providers[state.vcs]?.default_hosting || "none";

    state.userName =
      options.username || getPlatformUserGuess(state.vcs, gitConfig) || osUser;
    state.fullName = options.name || gitConfig["user.name"] || osUser || "User";

    state.projectName = options.projectName || "my-portfolio";

    // Validate resolved hosting platform
    if (
      state.hosting !== "none" &&
      !registry.hosting_platforms[state.hosting]
    ) {
      logger.error(`Unknown or invalid hosting platform: ${state.hosting}`);
      process.exit(1);
    }
  }

  //========================== Execution ==========================

  const newProjDir = path.resolve(process.cwd(), state.projectName);
  let hadError = false;

  //--------- Clear the console ----------------
  logger.resetView();
  logger.info.box("Initializing New Portosaur Project", {
    title: ` v${porto.version} `,
  });

  if (existsSync(newProjDir)) {
    logger.error(`Directory "${state.projectName}" already exists.`);
    process.exit(1);
  }

  //--------- Initialize Git repository ----------------

  if (state.vcs !== "none") {
    logger.info("Initializing new Git repository...");

    if (!hasCommand("git")) {
      throw new Error(
        "Git is required for version control, but 'git' was not found in PATH.",
      );
    }

    try {
      execFileSync("git", ["init", "-b", "main", newProjDir], {
        stdio: "pipe",
      });

      if (state.gitRemoteUrl) {
        execFileSync("git", ["remote", "add", "origin", state.gitRemoteUrl], {
          cwd: newProjDir,
          stdio: "pipe",
        });
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        logger.error("Git executable not found in PATH.");
      } else {
        const message =
          e.stderr?.toString()?.trim() ||
          e.stdout?.toString()?.trim() ||
          e.message;

        logger.error(`Failed to initialize Git repository: ${message}`);
      }
      process.exitCode = 1;
      return;
    }

    logger.info("Done!\n");
  }

  //------- Create directory and ensure content subdirectories -------------

  logger.info("Bootstrapping project directories...");

  try {
    ensureContentDirs(newProjDir);
  } catch (e) {
    logger.error(`Failed to bootstrap: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  //------- Mirror templates -------------

  logger.info("Creating project files...");

  // Prepare Template Variables

  // If the project name looks like a testing/demo project, prefer linking
  // to the CLI package to avoid loose dev-mode predictions.
  const isTestProject = looksLikeTestProject(state.projectName);

  const portoVer = isTestProject ? "*" : `^${porto.version || "0.0.0"}`;

  const templateVars = {
    projectName: state.projectName,
    userName: state.userName || "",
    fullName: state.fullName || "",
    portoVer,
    portoHome: porto.homepage || "",
    portoRepo: porto.repository || "",
  };

  try {
    mirrorSync(Paths.templates, newProjDir, templateVars, [
      "registry.yml",
      "workflows",
    ]);
  } catch (e) {
    logger.error(`Failed to create project files: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  logger.info("Done!\n");

  //------- Handle hosting workflows -------------

  let autoSetupDone = false;

  if (state.hosting && state.hosting !== "none") {
    const hConfig = registry.hosting_platforms[state.hosting];
    let workflowTemplate = hConfig?.template_dir;

    logger.info("Setting up Auto Deployment...");

    if (typeof workflowTemplate === "object") {
      workflowTemplate = workflowTemplate[state.vcs];
    }

    if (workflowTemplate) {
      const workflowDir = path.join(Paths.workflows, workflowTemplate);

      if (existsSync(workflowDir)) {
        try {
          mirrorSync(workflowDir, newProjDir, templateVars, ["node_modules"]);
          logger.info("Done!");
          autoSetupDone = true;
        } catch (e) {
          hadError = true;
          logger.error(`Failed to setup auto deployment: ${e.message}`);
          logger.warn(
            `Please setup later using ${colors.command("portosaur init-ci")}`,
          );
        }
      }
    }
  }

  //----------- Install dependencies -------------

  const pm = getPackageManager(newProjDir);

  if (options.install !== false) {
    logger.info(`Installing dependencies with ${pm.name}...`);

    try {
      execSync(pm.install, { cwd: newProjDir, stdio: "inherit" });
      logger.info("Dependencies installed!\n");
    } catch (e) {
      hadError = true;
      logger.error(e.message);
      logger.warn(
        "Failed to install dependencies, Please install manually later!\n",
      );
    }
  }

  //------------ Initial commit -------------

  if (state.vcs !== "none") {
    logger.start("Creating initial commit...");

    if (hasCommand("git")) {
      try {
        // Stage all files
        execSync("git add .", { cwd: newProjDir, stdio: "ignore" });

        // Commit the staged files
        execSync('git commit -m "Initialize Portosaur project"', {
          cwd: newProjDir,
          stdio: "pipe",
        });
        logger.info("Done!");
      } catch (e) {
        hadError = true;
        logger.error(e.stderr?.toString()?.trim() || e.message);
        logger.warn("Failed to make initial commit. Please do it later.");
      }
    } else {
      hadError = true;
      logger.error("Couldn't find git in PATH!");
      logger.warn("Skipping initial commit. Please do it later.");
    }

    logger.newLine();
  }

  // Add a .nojekyll to the project root during dev/build

  //----------------------- Final Output -----------------------

  if (!hadError) {
    logger.newLine();
    logger.resetView();
    logger.success.box(`Project successfully initialized!`);
  } else {
    logger.newLine();
    logger.success(`Project '${state.projectName}' initialized`);
    logger.warn("Some non-critical errors occurred (check logs above).");
    logger.newLine();
  }

  if (state.hosting !== "none" && autoSetupDone) {
    printWorkflowTips(
      registry.hosting_platforms,
      state.hosting,
      logger,
      templateVars,
    );
  }

  logger.newLine();
  logger.info(
    `Next Steps:\n    ${colors.command(`cd ${state.projectName} && ${pm.name} run dev`)}`,
  );

  logger.newLine();
}
