import * as prmpt from "@clack/prompts";
import chalk from "chalk";

export function renderHistory(steps, currentStep, state, intro) {
  if (process.env.NODE_ENV !== "test") {
    console.log("\n\u200B\n\n\n\n\n\u200B\n\u00A0");
    process.stdout.write("\x1B[2J\x1B[H");
  }

  console.log("");

  if (intro) {
    prmpt.intro(chalk.bgCyan.black(` ${intro} `));
    console.log(chalk.gray("│"));
    console.log(chalk.gray("│  [Enter] submit • [Esc] back • [Ctrl+C] exit "));
  }

  for (let i = 0; i < currentStep; i++) {
    const step = steps[i];
    if (step.runIf && !step.runIf(state)) continue;
    if (step.type === "pause" || step.type === "password") continue;

    if (i === 0) console.log(chalk.gray("│"));

    const value = state[step.id];

    if (value !== undefined) {
      const displayValue = step.display ? step.display(value, state) : value;

      if (displayValue !== null && displayValue !== "") {
        console.log(
          `${chalk.gray("│")}  ${chalk.dim(step.label || step.id)} ${chalk.gray("›")} ${chalk.cyan(displayValue)}`,
        );
      }
    }
  }
}
