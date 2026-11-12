# @portosaur/wizard

A general-purpose interactive CLI prompt library designed for managing complex, multi-step workflows. Built on top of `@clack/prompts`. It adds many additional features like back-navigation, history persistence, and dynamic branching.

## Features

- **🔙 Back-Navigation** — Return to previous steps using the **Escape** key without terminal artifacts.
- **🔄 History Replay** — Maintains session context by redrawing previous responses at the top of the terminal.
- **🛡️ Signal Handling** — Robust handling for `Ctrl+C` with clean terminal termination.
- **🔀 Dynamic Branching** — Skip or modify steps based on previous answers.

## Installation

```bash
bun add @portosaur/wizard
```

## 📖 Usage

```javascript
import { runWizard } from "@portosaur/wizard";

const state = await runWizard({
  intro: "Project Setup",
  steps: [
    {
      id: "name",
      type: "text",
      label: "Project Name",
      message: "Enter your project name",
      required: true,
    },
    {
      id: "vcs",
      type: "select",
      label: "VCS",
      message: "Choose a provider",
      options: [
        { value: "github", label: "GitHub" },
        { value: "gitlab", label: "GitLab" },
      ],
    },
    {
      id: "confirm",
      type: "confirm",
      label: "Confirm",
      message: "Are you sure?",
      backOn: false, // Return to previous step if "No" is selected
    },
  ],
});

console.log(state);
```

- Output:

```json
{ "name": "sosf", "vcs": "github", "confirm": true }
```

## 📖 Documentation

For the full API reference, advanced examples, and detailed guides on dynamic branching, please visit our official documentation site:

👉 **[Wizard Documentation](https://soymadip.github.io/portosaur/dev/wizard)**
