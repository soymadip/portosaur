import * as prmpt from "@clack/prompts";
import chalk from "chalk";
import { renderHistory } from "./renderer.mjs";
import { renderStep, coerceAnswer, buildPromptOpts } from "./prompts.mjs";
import readline from "readline";

export * from "@clack/prompts";
import * as prmpt_original from "@clack/prompts";

/**
 * Custom cancel that adds a connector bar for the tree-style logs
 */
export const cancel = (msg) => {
  process.stdout.write(`${chalk.gray("│")}\n`);
  prmpt_original.cancel(msg);
};

/**
 * Runs an interactive CLI wizard.
 * Handles navigation (forward/back), state management, and alternate screen buffering.
 * @param {Object} options - Wizard configuration.
 * @param {string} [options.intro] - Text to show at the start.
 * @param {string|false} [options.outro] - Text to show at the end.
 * @param {Array<Object>} options.steps - List of step definitions.
 * @param {Object} [options.initialState={}] - Initial state for the wizard.
 * @returns {Promise<Object>} The final state object.
 */
export async function runWizard({ intro, outro, steps, initialState = {} }) {
  const ENTER_ALT_SCREEN = "\x1b[?1049h";
  const EXIT_ALT_SCREEN = "\x1b[?1049l";
  const CLEAR_SCREEN = "\x1b[2J\x1b[H";

  let currentStep = 0;
  const state = { ...initialState };
  const maxSteps = steps.length;
  let isAltScreenActive = false;

  const handleInterrupt = (_char, key) => {
    if (key?.ctrl && key.name === "c") {
      if (isAltScreenActive) {
        process.stdout.write(EXIT_ALT_SCREEN);
      }
      process.stdout.write("\x1B[2A\x1B[0J");
      process.stdout.write(`\n${chalk.gray("│")}\n`);
      prmpt.cancel("Setup aborted.");
      process.exit(130);
    }
  };

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", handleInterrupt);

    if (process.stdout.isTTY) {
      process.stdout.write(ENTER_ALT_SCREEN + CLEAR_SCREEN);
      isAltScreenActive = true;
    }
  }

  try {
    const goBack = () => {
      currentStep--;

      while (
        currentStep > 0 &&
        steps[currentStep].runIf &&
        !steps[currentStep].runIf(state)
      ) {
        currentStep--;
      }
      renderHistory(steps, currentStep, state, intro);
    };

    renderHistory(steps, currentStep, state, intro);

    while (currentStep >= 0 && currentStep < maxSteps) {
      const step = steps[currentStep];

      if (step.runIf && !step.runIf(state)) {
        if (state[step.id] == null && step.initialValue !== undefined) {
          try {
            const { initialValue } = buildPromptOpts(step, state);
            state[step.id] = initialValue;
          } catch (e) {
            // Ignore initialValue evaluation errors for skipped steps
          }
        }
        currentStep++;
        continue;
      }

      // Note: `onEnter` hooks were removed to avoid automatic side-effects
      // (e.g. reopening a browser) when a user navigates back to a step.

      // Race the prompt with an Escape watcher: some prompts don't always
      // surface a cancel sentinel, so we listen for raw Escape and treat it
      // as a back/cancel. The watcher is only active for TTY sessions.
      let answer;
      if (process.stdin.isTTY) {
        let removeEscListener;
        const escPromise = new Promise((resolve) => {
          const escHandler = (_char, key) => {
            if (
              key?.name === "escape" ||
              key?.name === "esc" ||
              key?.sequence === "\u001b"
            ) {
              resolve({ __escape: true });
            }
          };
          process.stdin.on("keypress", escHandler);
          removeEscListener = () =>
            process.stdin.removeListener("keypress", escHandler);
        });

        const renderPromise = renderStep(step, state);
        answer = await Promise.race([renderPromise, escPromise]);
        if (removeEscListener) removeEscListener();
      } else {
        answer = await renderStep(step, state);
      }

      // Special case: pause step can return its own escape marker; handle
      // both that and the generic escape marker here.
      if (answer && (answer.__pauseEscape || answer.__escape)) {
        goBack();
        continue;
      }

      if (prmpt.isCancel(answer)) {
        if (currentStep === 0) {
          process.stdout.write("\x1B[2A\x1B[0J");
          process.stdout.write(`\n${chalk.gray("│")}\n`);
          prmpt.cancel("Setup aborted.");

          if (isAltScreenActive) {
            process.stdout.write(EXIT_ALT_SCREEN);
          }
          process.exit(0);
        }
        goBack();
        continue;
      }

      const shouldGoBack =
        typeof step.backOn === "function"
          ? step.backOn(answer, state)
          : step.backOn !== undefined && answer === step.backOn;

      if (shouldGoBack) {
        goBack();
        continue;
      }

      if (step.onResponse) {
        const action = step.onResponse(answer, state, { back: () => "back" });
        if (action === "back") {
          goBack();
          continue;
        }
      }

      state[step.id] = coerceAnswer(step, answer, state);
      currentStep++;
      renderHistory(steps, currentStep, state, intro);
    }
  } finally {
    if (isAltScreenActive) {
      process.stdout.write(EXIT_ALT_SCREEN);
    }

    if (process.stdin.isTTY) {
      process.stdin.removeListener("keypress", handleInterrupt);
    }
  }

  if (outro !== false) {
    typeof outro === "string"
      ? prmpt.outro(outro)
      : console.log(chalk.gray("└"));
  }

  return state;
}
