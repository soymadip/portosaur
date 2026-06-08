# Logger (`@{{meta.project.title}}/logger`)

A lightweight, Docusaurus-compatible logging library that brings the familiar Docusaurus terminal logging to any project, with some extras.

### Features

- **Standard levels**: Messages are Routed through `@docusaurus/logger` to ensure perfect visual parity with native Docusaurus's logs.
- **Custom levels**: `tip`, `note` use `console.log` + `_formatMsg` to produce a consistent `[LABEL]` format.
- **Box Headings**: Every level is a `LevelFn`, a callable function with a `.box()` sub-method.
- **CI/CD optimization** — `.box()` calls automatically degrade to a plain inline log when `process.env.CI` is set.

> [!NOTE]
> This library also exports a color api for message formatting, check [`colors`](#colors) section for more info

## Logging

All levels are `LevelFn` objects:

```typescript
interface LevelFn {
  (msg: string): void;
  box(msg: string, options?: BoxOptions): void;
}

interface BoxOptions {
  title?: string;
  padding?: number;
  border?: "rounded" | "single" | "double" | "none";
}
```

| Level     | Backend              | Label       | Color   |
| :-------- | :------------------- | :---------- | :------ |
| `info`    | `@docusaurus/logger` | `[INFO]`    | Cyan    |
| `success` | `@docusaurus/logger` | `[SUCCESS]` | Green   |
| `warn`    | `@docusaurus/logger` | `[WARNING]` | Yellow  |
| `error`   | `@docusaurus/logger` | `[ERROR]`   | Red     |
| `debug`   | `@docusaurus/logger` | `[INFO]`    | Cyan    |
| `tip`     | `console.log`        | `[TIP]`     | Magenta |
| `note`    | `console.log`        | `[NOTE]`    | Gray    |

### Usage

```js
import logger from "@{{meta.project.title}}/logger";

// Inline log
logger.info("Starting setup...");
logger.success("Build complete!");
logger.warn("Dependency may be outdated");
logger.error("Build failed");
logger.tip("Run {{meta.pkg.bin}} dev to preview");
logger.note("Remember to commit your changes");

// Debug — only shown when DEBUG=1 or VERBOSE=1
logger.debug("Resolved config path: /home/user/config.yml");

// New line — logs a blank line
logger.newLine();

// Start helper — logs a new line followed by info
logger.start("Bootstrapping project...");

// Clear — hard clear of the terminal history (ANSI reset)
logger.clear();

// Reset view — clears the current visible screen (ANSI)
logger.resetView();

// Wait — async sleep/delay (ms). Skips automatically in test/CI.
await logger.wait(1000);

// Force in CI or Test if needed
await logger.wait(1000, { ci: true, test: true });

// Box — color pre-applied from the level's semantic color.
// Default title is the level name (e.g. "SUCCESS") with spaces.
logger.success.box("Build complete!");

// Custom title — automatically wrapped in spaces (" Result ")
logger.success.box("Build complete!", { title: "Result" });

// Explicitly empty title — renders without a title bar
logger.info.box("Plain box without title", { title: "" });
```

## Colors

The `colors` export is a semantic chalk wrapper for use in message formatting

### Usage

```js
import { colors } from "@{{meta.project.title}}/logger";

console.log(colors.command("{{meta.pkg.bin}} dev")); // cyan bold
console.log(colors.url("https://...")); // cyan underline
console.log(colors.muted("(optional)")); // gray
console.log(colors.heading("Result")); // yellow
```

**Semantic palette:**

| Key       | Style          | Intended Use                   |
| :-------- | :------------- | :----------------------------- |
| `muted`   | Gray           | Subdued hints, placeholders    |
| `success` | Green          | Success messages               |
| `warn`    | Yellow         | Warnings                       |
| `error`   | Red            | Errors                         |
| `info`    | Blue           | Informational text             |
| `tip`     | Magenta bold   | `[TIP]` prefix                 |
| `heading` | Yellow         | Note/box headings              |
| `command` | Cyan bold      | Shell commands / code snippets |
| `label`   | White bold     | Field labels                   |
| `url`     | Cyan underline | Clickable URLs                 |

> [!INFO]
> Standard chalk modifiers (`bold`, `dim`, `italic`, `underline`, etc.) and foreground/background colors are also available on the `colors` object.
