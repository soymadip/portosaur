# @portosaur/logger

A lightweight, Docusaurus-compatible logging library enhanced with semantic levels, flexible alignment.

Designed to provide the familiar Docusaurus terminal experience to any CLI project, while adding essential utilities like `consola`-powered boxes and custom `tip`/`note` levels.

## Install

```bash
bun add @portosaur/logger

# or
npm install @portosaur/logger
```

## Usage

```js
import logger, { colors } from "@portosaur/logger";

// Inline log
logger.info("Starting setup...");
logger.success("Build complete!");
logger.warn("Dependency outdated");
logger.error("Build failed");
logger.tip("Run dev to preview");
logger.note("Remember to commit");

// Debug — only shown when DEBUG=1 or VERBOSE=1
logger.debug("Resolved config: /home/user/config.yml");

// Box — color pre-applied per level, CI-safe
logger.success.box("Build complete!", { title: "Result" });
logger.warn.box("Outdated dependency found", { title: "Warning" });
logger.note.box("Project initialized", { title: "Next Steps" });

// Start — helper that resets view and logs info
logger.start("Bootstrapping project...");

// Semantic colors
console.log(colors.command("porto dev"));
console.log(colors.url("https://example.com"));
console.log(colors.muted("(optional)"));
```

## Log Levels

Every level is a `LevelFn`:

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

| Level     | Label       | Notes                                    |
| :-------- | :---------- | :--------------------------------------- |
| `info`    | `[INFO]`    | Standard informational message           |
| `success` | `[SUCCESS]` | Operation completed successfully         |
| `warn`    | `[WARNING]` | Non-fatal warning                        |
| `error`   | `[ERROR]`   | Error message                            |
| `debug`   | `[INFO]`    | Only shown when `DEBUG=1` or `VERBOSE=1` |
| `tip`     | `[TIP]`     | Magenta colored label                    |
| `note`    | `[NOTE]`    | Gray colored label                       |

## Utilities

- **`logger.start(msg)`**: A specialized helper that calls `logger.resetView()` and then `logger.info(msg)`. Ideal for initiating a new process.
- **`logger.resetView()`**: Clears the console and resets cursor position.
- **`logger.clear()`**: A standard console clear (no-op in test environments).

`.box()` on any level automatically degrades to an inline log when `CI=true`.

## Colors

```js
import { colors } from "@portosaur/logger";

colors.bold("text");
colors.command("porto dev"); // cyan bold — shell commands
colors.url("https://..."); // cyan underline
colors.muted("(optional)"); // gray — hints
colors.heading("Result"); // yellow — titles
colors.label("Name"); // white bold — field labels
```

Standard chalk colors (`red`, `green`, `blue`, etc.) and modifiers (`bold`, `dim`, `italic`, etc.) are also available.

## License

GPL-3.0-only
