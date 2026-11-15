/**
 * Determines if the CLI should run in interactive mode based on provided options.
 *
 * Providing any configuration flag forces non-interactive mode.
 *
 * @param {Object} options - Command options (flags).
 * @returns {boolean}
 */
export function isInteractive(options = {}) {
  // Flags that trigger non-interactive mode
  const hasConfigOptions = Object.keys(options).some((key) => {
    if (key === "install") {
      return false;
    }
    return options[key] !== undefined && options[key] !== null;
  });

  if (hasConfigOptions) {
    return false;
  }

  // Otherwise, default to interactive
  return true;
}
