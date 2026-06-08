# Interaction Engine (Wizard)

The `@{{meta.project.title}}/wizard` package is a prompt utility designed for managing complex CLI workflows. It is built on top of `@clack/prompts` and adds essential features for long-running interaction sessions.

## Key Features

- **Back-Navigation**: Move back through steps using the **Escape** key.
- **Alternate Screen Buffer**: Automatically switches to the terminal's alternate buffer during interaction & jumps back after completion.
- **History Management**: Redraws previous responses at the top of the terminal to maintain session context.
- **Conditional Steps**: Logic-based skipping of questions based on previous answers.
- **Dynamic Resolution**: Questions, options, and defaults can be functions of the current state.

## Getting Started

```javascript
import { runWizard } from "@{{meta.project.title}}/wizard";

const state = await runWizard({
  intro: "Project Setup",
  steps: [
    {
      id: "name",
      type: "text",
      label: "Project Name",
      prompt: "Enter your project name",
      initialValue: "my-project",
    },
    {
      id: "hosting",
      type: "select",
      label: "Hosting",
      prompt: "Select a hosting platform",
      options: [
        { value: "github", label: "GitHub Pages" },
        { value: "surge", label: "Surge" },
      ],
    },
  ],
});
```

## API Reference

### `runWizard(options)`

The main orchestrator for multi-step flows.

#### Options

| Option         | Type              | Description                                                                                                                                            |
| :------------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intro`        | `string`          | The heading to display at the start.                                                                                                                   |
| `outro`        | `string \| false` | Closing behavior. A string shows a message via clack's `outro()`. `false` skips closing entirely (use when spinners follow). Omit for a bare `└` line. |
| `steps`        | `Array`           | List of step definitions.                                                                                                                              |
| `initialState` | `Object`          | Optional starting state.                                                                                                                               |

## Steps Definition Reference

Each step in the `steps` array is an object that configures a single interaction.

### `id` (Required)

- **Type**: `string`
- **Description**: The unique identifier for this step. This serves as the key in the final state object returned by `runWizard`.
- For example, if `id: "vcs"`, the user's answer will be accessible at `state.vcs`.

### `type` (Required)

- **Type**: `string`
- **Options**: `text`, `password`, `number`, `select`, `multiselect`, `confirm`, `pause`.
- **Description**: Defines the interaction pattern.
  - `text` — free-form string input.
  - `password` — masked input (not shown in history).
  - `number` — numeric input, stored as a JS `number`. Supports `min` and `max` on the step.
  - `select` — single-choice list.
  - `multiselect` — multiple-choice list.
  - `confirm` — Yes/No toggle.
  - `pause` — shows a prompt and waits for Enter. Stores `true`, not shown in history.

### `label` (Required)

- **Type**: `string`
- **Description**: The short, descriptive name shown in the "History" view. Once a step is completed, it appears in a vertical list on the left (e.g., `vcs › github`). This helps users track their progress through a long workflow.

### `prompt` (Required)

- **Type**: `string | Function`
- **Description**: The main prompt text displayed to the user. This is the "question" they are answering.
- **Dynamic Usage**: Pass a function `(state) => string` to generate the text based on previous answers. For example, `prompt: (s) => "Enter your " + s.vcs + " username"`.

### `level`

- **Type**: `string`
- **Options**: `info`, `warn`, `error`, `success`.
- **Default**: `undefined` (Neutral bold styling)
- **Description**: Automatically styles the prompt with a semantic color (e.g., yellow for `warn`, red for `error`). This ensures visual consistency without needing manual `chalk` wrapping.

### `hint`

- **Type**: `string | Function`
- **Default**: `undefined`
- **Description**: Secondary information or context displayed in gray parentheses directly after the prompt. This is ideal for explaining _why_ a piece of information is needed or providing formatting tips.
- **Example**: `hint: "Used for your public profile"` becomes `(Used for your public profile)`.

### `initialValue`

- **Type**: `any | Function`
- **Default**: `undefined`
- **Description**: The value that pre-fills the prompt. For `text` fields, it's what the user sees before they start typing. For `select` fields, it determines which option is highlighted by default.
- **Reactive Defaults**: If a step is skipped via `runIf: false`, this value (or the result of its function) is **automatically merged into the state**. This allows for declarative derived state even when a user isn't prompted.
- **Dynamic Usage**: `(state) => any`. Useful for "guessing" defaults based on environment or previous steps.

### `required`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: A declarative shorthand for non-empty validation. If `true`, the wizard will prevent the user from proceeding if the input is empty or contains only whitespace. An error message is automatically generated and displayed.

### `validate`

- **Type**: `Function`
- **Default**: `undefined`
- **Description**: Custom validation logic for the user's input.
- **Signature**: `(value) => string | undefined`
- **Behavior**: If the function returns a string, the wizard displays it as an error and prevents the user from continuing. If it returns `undefined` (or nothing), the input is accepted.

### `transform`

- **Type**: `Function`
- **Default**: `undefined`
- **Description**: Mutates the answer before it is stored in the state. Runs after validation and `onResponse`, so it's the last thing that touches the value.
- **Signature**: `(value, state) => any`
- **Example**: `transform: (v) => v.trim().toLowerCase()` — normalizes text input without polluting the consumer code.

### `backOn`

- **Type**: `any | Function`
- **Default**: `undefined`
- **Description**: Declarative back-navigation. This property allows you to create "loops" or "undo" paths in your wizard without manual logic.
- **Equality Check**: If `result === backOn`, the wizard automatically returns to the previous step.
- **Predicate Check**: `(value, state) => boolean`. If the function returns `true`, the wizard goes back.
- **Common Use**: `backOn: false` on a confirmation step to allow users to "second-guess" a previous risky choice.

### `onResponse`

- **Type**: `Function`
- **Default**: `undefined`
- **Description**: The ultimate control hook. It is triggered after the user submits an answer but _before_ the wizard updates the state or moves to the next step.
- **Tools**: Provides a `{ back }` utility to programmatically trigger a return to the previous question.
- **Signature**: `(value, state, { back }) => void | "back"`

### `runIf`

- **Type**: `Function`
- **Default**: `undefined` (Always runs)
- **Description**: Controls the visibility of the step. If this function returns `false`, the wizard skips this step entirely and moves to the next one in the list.
- **Signature**: `(state) => boolean`
- **Context**: Used heavily for branching logic (e.g., only ask for a password if `authType` is `true`).

### `display`

- **Type**: `Function`
- **Default**: `undefined` (Renders raw value)
- **Description**: Customizes how the user's answer is rendered in the history view.
- **Signature**: `(value, state) => string`
- **Example**: Useful for masks (e.g., `display: (v) => "****"`) or formatting complex selection objects into readable labels.

## Key Commands

- **`Enter`** — Submit the current step.
- **`Escape`** — Return to the previous step.
- **`Ctrl+C`** — Terminate the process immediately.
