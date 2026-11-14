import * as prmpt from "@clack/prompts";
import chalk from "chalk";
import { renderHistory } from "./renderer.ts";
import { renderStep, coerceAnswer, buildPromptOpts } from "./prompts.ts";
import readline from "node:readline";

export * from "@clack/prompts";
import * as prmpt_original from "@clack/prompts";

export interface WizardStep {
  /** Unique identifier for the step value in the state object. */
  id: string;

  /** Interaction pattern for the prompt. */
  type:
    | "text"
    | "password"
    | "number"
    | "select"
    | "multiselect"
    | "confirm"
    | "pause";

  /** Short label used in the history display (e.g., "vcs › github"). */
  label: string;

  /** Main question shown to the user. Can be a string or a function of current state. */
  prompt: string | ((state: any) => string);

  /** Secondary context shown in parentheses. */
  hint?: string | ((state: any) => string);

  /** Grayed-out placeholder text inside the input. */
  placeholder?: string;

  /** Initial value for the prompt or the default if skipped. */
  initialValue?: any | ((state: any) => any);

  /** Custom validation logic. Return a string to show an error. */
  validate?: (value: any) => string | undefined | void;

  /** Mutates the answer before it hits the state. */
  transform?: (value: any, state: any) => any;

  /** If false, the step is skipped and reactive defaults are applied. */
  runIf?: (state: any) => boolean;

  /** Required for select/multiselect types. */
  options?: any[] | ((state: any) => any[]);

  /** If true, validation fails on empty input. */
  required?: boolean;

  /** Minimum value for "number" type. */
  min?: number;

  /** Maximum value for "number" type. */
  max?: number;

  /** Visual style for the message (e.g., "warn" for yellow). */
  level?: "info" | "warn" | "error" | "success";

  /** Custom formatter for the history view. */
  display?: (value: any, state: any) => string;

  /** Programmatic back-navigation based on the answer. */
  backOn?: any | ((value: any, state: any) => boolean);

  /** Post-submission hook for side-effects or manual navigation. */
  onResponse?: (
    value: any,
    state: any,
    tools: { back: () => "back" },
  ) => void | "back" | Promise<void | "back">;
}

export interface WizardOptions {
  /** Heading displayed at the very start. */
  intro?: string;

  /** Closing behavior. string = message, false = skip, undefined = bare line. */
  outro?: string | false;

  /** Sequential list of interactive steps. */
  steps: WizardStep[];

  /** Optional starting values. */
  initialState?: Record<string, any>;
}

/**
 * Custom cancel that adds a connector bar for the tree-style logs
 */
export const cancel = (msg?: string) => {
  process.stdout.write(`${chalk.gray("│")}\n`);
  prmpt_original.cancel(msg);
};

/**
 * Runs an interactive, multi-step CLI wizard with back-navigation and state persistence.
 * Handles navigation (forward/back), state management, and alternate screen buffering.
 */
export async function runWizard({
  intro,
  outro,
  steps,
  initialState = {},
}: WizardOptions): Promise<Record<string, any>> {
  const ENTER_ALT_SCREEN = "\x1b[?1049h";
  const EXIT_ALT_SCREEN = "\x1b[?1049l";
  const CLEAR_SCREEN = "\x1b[2J\x1b[H";

  let currentStep = 0;
  const state = { ...initialState };
  const maxSteps = steps.length;
  let isAltScreenActive = false;

  if (intro) {
    console.log();
    prmpt.intro(intro);
  }

  const handleInterrupt = (_char: string, key?: readline.Key) => {
    if (key?.ctrl && key.name === "c") {
      if (isAltScreenActive) {
        process.stdout.write(EXIT_ALT_SCREEN);
      }
      process.stdout.write(`${chalk.gray("│")}\n`);
      prmpt.cancel("Setup aborted.");
      process.exit(130);
    }
  };

  if (process.stdin.isTTY) {
    // Node's runtime accepts an options object here (`escapeCodeTimeout`
    // shortens the wait for ambiguous escape sequences), but @types/node
    // only declares the `readline.Interface` form — hence the cast.
    readline.emitKeypressEvents(process.stdin, {
      escapeCodeTimeout: 50,
    } as unknown as readline.Interface);
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
        !steps[currentStep].runIf!(state)
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
      let answer: any;
      if (process.stdin.isTTY) {
        let removeEscListener: (() => void) | undefined;
        const escPromise = new Promise((resolve) => {
          const escHandler = (_char: string, key?: readline.Key) => {
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
        if (removeEscListener) {
          removeEscListener();
        }
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
          if (isAltScreenActive) {
            process.stdout.write(EXIT_ALT_SCREEN);
          }
          process.stdout.write(`${chalk.gray("│")}\n`);
          prmpt.cancel("Setup aborted.");
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
