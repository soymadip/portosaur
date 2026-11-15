/**
 * Validates that only one prop from a mutually exclusive group is provided.
 *
 * This utility is intended for component development and performs no validation
 * in production builds.
 *
 * @param {string} component - Name of the component performing the validation.
 * @param {string} group - Name of the mutually exclusive prop group (e.g. "variant", "hint").
 * @param {Record<string, unknown>} props - Object mapping prop names to their values.
 *
 * @throws {Error} If more than one prop in the group is provided.
 */
export default function checkDuplicateProps(component, group, props) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const active = Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key]) => key);

  if (active.length > 1) {
    throw new Error(
      `[${component}] ${group}: Props ${active.join(", ")} are mutually exclusive. ` +
        `Choose only one of: ${Object.keys(props).join(", ")}.`,
    );
  }
}
