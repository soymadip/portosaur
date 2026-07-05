import { readFileSync, existsSync, renameSync } from "fs";
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

  const resolveFinalRepoName = (state, opts, reg) => {
    if (opts.projectName) return opts.projectName;

    if (state.siteType === "portfolio") {
      if (state.repoNameChoice === "ideal") {
        const hConfig = reg.hosting_platforms[state.hostingPlatform];
        const vcsConfig = reg.vcs_providers[state.vcsProvider];
        return hConfig.repo.ideal_name
          .replace("{{user}}", state.vcsUsername)
          .replace("{{domain}}", vcsConfig.domain);
      }
      return state.customRepoName;
    }
    return state.repoName;
  };

  let state = {
    siteType: null,
    vcsProvider: null,
    hostingPlatform: null,
    vcsUsername: null,
    fullName: null,
    projectName: null,
    repoName: options.projectName || null,
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
          prompt: "What type of site do you want?",
          id: "siteType",
          type: "select",
          options: [
            {
              label: "Portfolio Site",
              value: "portfolio",
              hint: "Showcase your digital personality, projects & write notes, blogs",
            },
            {
              label: "Documentation Site",
              value: "docs",
              hint: "Create documentation site for a project",
            },
          ],
        },
        {
          prompt: "Enter project name",
          id: "projectName",
          type: "text",
          hint: "The name of your project (e.g. 'Portosaur')",
          required: true,
          runIf: (state) => state.siteType === "docs",
          initialValue: () => "My Project",
          transform: (v) => v.trim(),
        },
        {
          prompt: "Enter directory/repo name",
          id: "repoName",
          type: "text",
          hint: "The name of the local folder and git repository",
          required: true,
          runIf: (state) => !options.projectName && state.siteType === "docs",
          initialValue: (state) => {
            if (state.siteType === "docs" && state.projectName) {
              return state.projectName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            }
            return "my-portfolio";
          },
          validate: (value) => {
            if (/[^a-zA-Z0-9_.-]/.test(value))
              return "Repository name can only contain letters, numbers, hyphens, and underscores (no spaces).";
          },
          transform: (v) => v.trim(),
        },
        {
          prompt: "Enter your full name",
          id: "fullName",
          type: "text",
          hint: "Used for the site title etc..",
          required: true,
          runIf: (state) => !options.name && state.siteType === "portfolio",
          initialValue: () => gitConfig["user.name"] || osUser || "Your Name",
          transform: (v) => v.trim(),
        },
        {
          prompt: "Choose Your VCS Provider",
          id: "vcsProvider",
          type: "select",
          options: [
            ...Object.entries(registry.vcs_providers).map(([id, cfg]) => ({
              value: id,
              label: cfg.name,
            })),
            { value: "none", label: "Local only / Skip" },
          ],
        },
        {
          prompt: (state) =>
            `Enter your ${registry.vcs_providers[state.vcsProvider]?.name || state.vcsProvider} ${state.siteType === "docs" ? "username/organization" : "username"}`,
          id: "vcsUsername",
          type: "text",
          required: true,
          runIf: (state) => state.vcsProvider !== "none",
          initialValue: (state) =>
            getPlatformUserGuess(state.vcsProvider, gitConfig) || osUser,
          transform: (v) => v.trim(),
        },
        {
          prompt: "Where do you want to host your site?",
          id: "hostingPlatform",
          type: "select",
          hint: "Auto deployment (CI/CD) will be setup",
          runIf: (state) => state.vcsProvider !== "none",
          options: (state) => {
            const vcsConfig = registry.vcs_providers[state.vcsProvider];
            return [
              ...Object.entries(registry.hosting_platforms)
                .filter(([id, cfg]) => {
                  const supported = cfg.supported_providers || [];
                  const isAgnostic =
                    supported === "all" ||
                    (Array.isArray(supported) && supported.includes("all"));

                  const canProvideTemplate =
                    typeof cfg.template_dir === "string" ||
                    cfg.template_dir?.[state.vcsProvider];

                  return (
                    (isAgnostic || supported.includes(state.vcsProvider)) &&
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
            registry.vcs_providers[state.vcsProvider]?.default_hosting ||
            "none",
        },
        {
          prompt: "Choose your portfolio's repository name",
          id: "repoNameChoice",
          type: "select",
          hint: "This will be used as dir name too",
          runIf: (state) => {
            if (
              options.projectName ||
              state.siteType === "docs" ||
              state.hostingPlatform === "none" ||
              state.vcsProvider === "none"
            )
              return false;
            const hConfig = registry.hosting_platforms[state.hostingPlatform];
            return !!hConfig?.repo?.ideal_name;
          },
          options: (state) => {
            const hConfig = registry.hosting_platforms[state.hostingPlatform];
            const vcsConfig = registry.vcs_providers[state.vcsProvider];
            const idealName = hConfig.repo.ideal_name
              .replace("{{user}}", state.vcsUsername)
              .replace("{{domain}}", vcsConfig.domain);
            return [
              {
                value: "ideal",
                label: `Use ${idealName}`,
                hint: `Becomes: 'https://${state.vcsUsername}.${hConfig.domain}/'`,
              },
              {
                value: "custom",
                label: "Custom...",
                hint: `Becomes: 'https://${state.vcsUsername}.${hConfig.domain}/<custom-repo-name>/'. Not recommended!`,
              },
            ];
          },
        },
        {
          prompt: (state) => {
            const hConfig = registry.hosting_platforms[state.hostingPlatform];
            const vcsConfig = registry.vcs_providers[state.vcsProvider];

            const idealName = hConfig.repo.ideal_name
              .replace("{{user}}", state.vcsUsername)
              .replace("{{domain}}", vcsConfig.domain);

            const finalName = "<custom-name>";

            const msg = hConfig.repo.mismatch_msg
              .replace("{{ideal_name}}", idealName)
              .replace("{{user}}", state.vcsUsername)
              .replace("{{domain}}", hConfig.domain)
              .replace("{{project_name}}", finalName);

            return `${colors.yellow(msg)}\nAre You Sure?`;
          },
          id: "repoNameWarning",
          type: "confirm",
          runIf: (state) => {
            return (
              state.siteType === "portfolio" &&
              state.repoNameChoice === "custom"
            );
          },
          initialValue: true,
          onResponse: (value, state) => {
            if (!value) {
              logger.info("\nSetup aborted.");
              process.exit(0);
            }
          },
        },
        {
          prompt: "Enter custom directory/repo name",
          id: "customRepoName",
          type: "text",
          hint: "The name of the local folder and git repository",
          required: true,
          runIf: (state) => {
            if (state.siteType === "docs" || options.projectName) return false;
            return (
              state.repoNameChoice === "custom" ||
              state.repoNameChoice === undefined
            );
          },
          initialValue: () => "my-portfolio",
          validate: (value) => {
            if (/[^a-zA-Z0-9_.-]/.test(value))
              return "Repository name can only contain letters, numbers, hyphens, and underscores (no spaces).";
          },
          transform: (v) => v.trim(),
        },
        {
          prompt: "Open browser to create the repository?",
          id: "openBrowser",
          type: "confirm",
          hint: "Redirects you to the 'New Repository' page on your Git host",
          runIf: (state) => state.vcsProvider !== "none",
          initialValue: true,
          onResponse: (val, state) => {
            if (val && state.vcsProvider !== "none") {
              const vcsConfig = registry.vcs_providers[state.vcsProvider];
              const finalRepoName = resolveFinalRepoName(
                state,
                options,
                registry,
              );
              const newRepoUrl = vcsConfig.new_url
                .replace("{{user}}", state.vcsUsername)
                .replace("{{project_name}}", finalRepoName)
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
            if (state.vcsProvider === "none") return false;
            if (state.openBrowser === undefined) return true;
            if (state.openBrowser === false) return false;
            const sval = String(state.openBrowser).toLowerCase();
            return !(sval === "false" || sval === "0" || sval === "no");
          },
        },
        {
          prompt: "Confirm git repository URL",
          id: "gitRemoteUrl",
          type: "text",
          hint: "Needed to link your local project to the remote repository",
          required: true,
          runIf: (state) => state.vcsProvider !== "none",
          initialValue: (state) => {
            const vcsConfig = registry.vcs_providers[state.vcsProvider];
            const finalRepoName = resolveFinalRepoName(
              state,
              options,
              registry,
            );
            return vcsConfig.url
              .replace("{{user}}", state.vcsUsername)
              .replace("{{project_name}}", finalRepoName)
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

    // Map semantic variables back to legacy state so downstream code doesn't break
    state.repoName = resolveFinalRepoName(state, options, registry);
    state.vcs = state.vcsProvider;
    state.hosting = state.hostingPlatform;
    state.userName = state.vcsUsername;

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
    state.siteType = options.siteType || "portfolio";
    state.vcs = vcsProvider || Object.keys(registry.vcs_providers)[0];
    state.hosting =
      hosting || registry.vcs_providers[state.vcs]?.default_hosting || "none";

    state.userName =
      options.username || getPlatformUserGuess(state.vcs, gitConfig) || osUser;
    state.fullName = options.name || gitConfig["user.name"] || osUser || "User";

    state.repoName = options.projectName || "my-portfolio";

    if (state.vcs !== "none") {
      const vcsConfig = registry.vcs_providers[state.vcs];
      state.gitRemoteUrl = vcsConfig.url
        .replace("{{user}}", state.userName)
        .replace("{{project_name}}", state.repoName)
        .replace("{{domain}}", vcsConfig.domain);
    }

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

  const newProjDir = path.resolve(process.cwd(), state.repoName);
  let hadError = false;

  //--------- Clear the console ----------------
  logger.resetView();
  logger.info.box("Initializing New Portosaur Project", {
    title: ` v${porto.version} `,
  });

  if (existsSync(newProjDir)) {
    logger.error(`Directory "${state.repoName}" already exists.`);
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
    ensureContentDirs(newProjDir, state.siteType);
  } catch (e) {
    logger.error(`Failed to bootstrap: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  //------- Mirror templates -------------

  logger.info("Creating project files...");

  // Prepare Template Variables
  const cleanVersion = porto.version?.split("-")[0] || "0.0.0";
  const portoVersion = `^${cleanVersion}`;
  const cloneUrl = state.gitRemoteUrl || "<your-repository-url>";

  const templateVars = {
    project_name: state.projectName || state.repoName,
    repo_name: state.repoName,
    user_name: state.userName || "",
    full_name: state.fullName || "",
    clone_url: cloneUrl,
    porto_version: portoVersion,
    porto_home: porto.homepage || "",
    porto_repo: porto.repository || "",
  };

  try {
    const mirrorIgnores = ["registry.yml", "workflows"];

    if (state.vcs === "none") {
      mirrorIgnores.push("gitignore");
    }

    if (state.siteType === "docs") {
      mirrorIgnores.push("notes", "config-portfolio.yml");
    } else {
      mirrorIgnores.push("docs", "config-docs.yml");
    }

    mirrorSync(Paths.templates, newProjDir, templateVars, mirrorIgnores);

    // Rename the appropriate config file
    const configSource =
      state.siteType === "docs" ? "config-docs.yml" : "config-portfolio.yml";
    renameSync(
      path.join(newProjDir, configSource),
      path.join(newProjDir, "config.yml"),
    );
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
    logger.success(`Project '${templateVars.project_name}' initialized`);
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
    `Next Steps:\n    ${colors.command(`cd ${state.repoName} && ${pm.name} run dev`)}`,
  );

  logger.newLine();
}
