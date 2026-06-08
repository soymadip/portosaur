# Developer Overview

Welcome to the {{meta.project.title}} Developer Guide. This section is intended for developers and power users who want to extend the project.

## Monorepo Architecture

{{meta.project.title}} is structured as a monorepo. This ensures a clear separation between the CLI, the core logic, and the user-facing themes.

### Package Layout

> [!NOTE]
> Some of the packages are independent/standalone packages that can be used with any projects

| Package                                                                             | Purpose           | Key Responsibilities                                                                       |
| :---------------------------------------------------------------------------------- | :---------------- | :----------------------------------------------------------------------------------------- |
| [`@{{meta.project.title}}/cli`]({{meta.project.repo}}/tree/main/packages/cli)       | Orchestrator      | Command registration (`init`, `dev`, `build`), Docusaurus shimming, and CLI entry point.   |
| [`@{{meta.project.title}}/core`]({{meta.project.repo}}/tree/main/packages/core)     | Translation layer | YAML configuration parsing, recursive variable resolution, and system utility suite.       |
| [`@{{meta.project.title}}/theme`]({{meta.project.repo}}/tree/main/packages/theme)   | Visual Core       | React components, plugins, CSS styles, and default static assets.                          |
| [`@{{meta.project.title}}/wizard`]({{meta.project.repo}}/tree/main/packages/wizard) | Prompt Library    | **Standalone prompt library** with built-in history replaying and back-navigation.         |
| [`@{{meta.project.title}}/logger`]({{meta.project.repo}}/tree/main/packages/logger) | Logging Library   | **Standalone Logger library**, brings Docusaurus style logging with extra functionalities. |

## Core Logic Flow

1. **Initialization**: The `init` command uses `@{{meta.project.title}}/wizard` to gather user intent, then leverages `@{{meta.project.title}}/core` utilities to mirror templates and generate a `config.yml`.
2. **Development/Build**: When `{{meta.project.title}} dev` or `{{meta.project.title}} build` is executed, the CLI generates a temp Docusaurus config shim that dynamically imports the config builder from `@{{meta.project.title}}/core`, which resolves assets pointing to `@{{meta.project.title}}/theme`.
3. **Variable Resolution**: The configuration builder in `core` performs a recursive pass over the YAML data, resolving `{{...}}` tags from system variables, environment variables, and user-defined custom keys.
