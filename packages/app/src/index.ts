/**
 * The Portosaur app entry point: the Astro integration is the main export.
 */
// Re-exports `AppPaths` (both the interface and the object).
export * from "./utils/paths.ts";
export { default as portosaurIntegration } from "./integration.ts";
export { default } from "./integration.ts";
export type { PortosaurOptions } from "./integration.ts";
