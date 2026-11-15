export * from "@clack/prompts";

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
 * Runs an interactive, multi-step CLI wizard with back-navigation and state persistence.
 */
export function runWizard(options: WizardOptions): Promise<Record<string, any>>;
