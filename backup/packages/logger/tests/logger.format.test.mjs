import { expect, test, describe } from "bun:test";
import { _formatMsg, TARGET_WIDTH } from "../src/lib/helpers.mjs";

const stripAnsi = (s) => (s || "").replace(/\x1b\[[0-9;]*m/g, "");

describe("logger formatting", () => {
  test("single-line message aligns", () => {
    const levelLabel = "success";
    const labelText = `[${levelLabel.toUpperCase()}]`;
    const currentLabelLength = labelText.length + 1;
    const paddingCount = TARGET_WIDTH - currentLabelLength;
    const out = _formatMsg("Installation complete", levelLabel);
    const raw = stripAnsi(out);
    expect(raw).toBe(" ".repeat(paddingCount) + "Installation complete");
  });

  test("leading newline preserved", () => {
    const levelLabel = "error";
    const labelText = `[${levelLabel.toUpperCase()}]`;
    const currentLabelLength = labelText.length + 1;
    const paddingCount = TARGET_WIDTH - currentLabelLength;
    const out = _formatMsg("\nSetup aborted.", levelLabel);
    const raw = stripAnsi(out);
    expect(raw).toBe("\n" + " ".repeat(paddingCount) + "Setup aborted.");
  });

  test("multi-line message indents subsequent lines", () => {
    const levelLabel = "info";
    const labelText = `[${levelLabel.toUpperCase()}]`;
    const currentLabelLength = labelText.length + 1;
    const paddingCount = TARGET_WIDTH - currentLabelLength;
    const out = _formatMsg("Line1\nLine2\nLine3", levelLabel);
    const raw = stripAnsi(out);
    const expected =
      " ".repeat(paddingCount) +
      "Line1\n" +
      " ".repeat(TARGET_WIDTH) +
      "Line2\n" +
      " ".repeat(TARGET_WIDTH) +
      "Line3";
    expect(raw).toBe(expected);
  });
});
