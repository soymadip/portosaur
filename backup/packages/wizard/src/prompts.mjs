import * as prmpt from "@clack/prompts";
import chalk from "chalk";
import readline from "readline";

const levelStyles = {
  info: chalk.blueBright,
  warn: chalk.yellowBright,
  error: chalk.redBright,
  success: chalk.greenBright,
};

/**
 * Builds the options for a Clack prompt based on a wizard step definition.
 * @param {Object} step - The step definition.
 * @param {Object} state - The current wizard state.
 * @returns {Object} An object containing the initial value and Clack options.
 */
export function buildPromptOpts(step, state) {
  const promptText =
    typeof step.prompt === "function" ? step.prompt(state) : step.prompt;
  const hint = typeof step.hint === "function" ? step.hint(state) : step.hint;

  const levelStyle = levelStyles[step.level] || ((str) => str);
  const styledMessage = chalk.bold(levelStyle(promptText));

  const initialValue =
    typeof step.initialValue === "function"
      ? step.initialValue(state)
      : (state[step.id] ?? step.initialValue);

  return {
    initialValue,
    opts: {
      message: `${styledMessage}${hint ? ` ${chalk.gray(`(${hint})`)}` : ""}`,
      placeholder: step.placeholder ? chalk.gray(step.placeholder) : undefined,
      initialValue,
      validate: (val) => {
        if (step.validate) {
          return step.validate(val);
        }
        if (step.required && (!val || !val.trim())) {
          return `${step.label || step.id} is required!`;
        }
      },
    },
  };
}

/**
 * Renders a single wizard step.
 * @param {Object} step - The step definition to render.
 * @param {Object} state - The current wizard state.
 * @returns {Promise<any>} The answer from the user.
 */
export async function renderStep(step, state) {
  const { initialValue, opts } = buildPromptOpts(step, state);

  switch (step.type) {
    case "text":
      return await prmpt.text(opts);

    case "password":
      return await prmpt.password(opts);

    case "select":
      return await prmpt.select({
        ...opts,
        showInstructions: false,
        options:
          typeof step.options === "function"
            ? step.options(state)
            : step.options,
      });

    case "multiselect":
      return await prmpt.multiselect({
        ...opts,
        showInstructions: false,
        options:
          typeof step.options === "function"
            ? step.options(state)
            : step.options,
        initialValues: initialValue || [],
      });

    case "confirm":
      return await prmpt.confirm(opts);

    case "number": {
      const raw = await prmpt.text({
        ...opts,
        validate: (val) => {
          if (step.validate) {
            return step.validate(val);
          }
          if (step.required && !val?.trim()) {
            return `${step.label || step.id} is required!`;
          }
          if (val && isNaN(Number(val))) {
            return "Please enter a valid number.";
          }
          if (step.min !== undefined && Number(val) < step.min) {
            return `Must be at least ${step.min}.`;
          }
          if (step.max !== undefined && Number(val) > step.max) {
            return `Must be at most ${step.max}.`;
          }
        },
      });
      return raw;
    }

    case "pause": {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIdx = 0;

      if (!process.stdin.isTTY) {
        process.stdout.write(
          `${chalk.gray("│")}\n${chalk.gray("◆")}  ${opts.message}\n`,
        );
        return true;
      }

      process.stdout.write(
        `${chalk.gray("│")}\n${chalk.gray("◆")}  ${opts.message}\n`,
      );

      const animate = setInterval(() => {
        process.stdout.write(
          `\r${chalk.gray("│")}  ${chalk.cyan(frames[frameIdx++ % frames.length])}  ${chalk.dim("press Enter to continue...")}`,
        );
      }, 80);

      await new Promise((resolve) => {
        let resolved = false;
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        let onKey;
        const cleanup = () => {
          clearInterval(animate);
          try {
            rl.close();
          } catch (e) {}
          if (onKey) {
            process.stdin.removeListener("keypress", onKey);
          }
        };

        const onDone = () => {
          if (resolved) {
            return;
          }
          resolved = true;
          cleanup();
          process.stdout.write(
            `\r${chalk.gray("│")}  ${chalk.green("✓")}  ${chalk.dim("done")}\n`,
          );
          resolve();
        };

        onKey = (_char, key) => {
          if (key?.name === "return" || key?.name === "enter") {
            onDone();
          }

          if (
            key?.name === "escape" ||
            key?.name === "esc" ||
            key?.sequence === "\u001b"
          ) {
            if (resolved) {
              return;
            }
            resolved = true;
            cleanup();
            resolve({ __pauseEscape: true });
          }
        };

        rl.once("line", onDone);
        process.stdin.on("keypress", onKey);
      });

      return true;
    }

    default:
      throw new Error(`Unsupported wizard step type: ${step.type}`);
  }
}

/**
 * Coerces and transforms a user's answer based on the step configuration.
 * @param {Object} step - The step definition.
 * @param {any} answer - The raw answer from the prompt.
 * @param {Object} state - The current wizard state.
 * @returns {any} The transformed value.
 */
export function coerceAnswer(step, answer, state) {
  let value =
    step.type === "number" && typeof answer === "string"
      ? answer === ""
        ? answer
        : Number(answer)
      : answer;

  if (step.transform) value = step.transform(value, state);
  return value;
}
