/**
 * Determines if the CLI should run in interactive mode based on provided options.
 *
 * Providing any configuration flag forces non-interactive mode.
 *
 * @param {Object} options - Command options (flags).
 * @returns {boolean}
 */
export function isInteractive(options: object = {}): boolean {
  // Flags that trigger non-interactive mode
  const hasConfigOptions = Object.keys(options).some((key) => {
    if (key === "install") {
      return false;
    }
    const value = (options as Record<string, unknown>)[key];
    return value !== undefined && value !== null;
  });

  if (hasConfigOptions) {
    return false;
  }

  // Otherwise, default to interactive
  return true;
}
