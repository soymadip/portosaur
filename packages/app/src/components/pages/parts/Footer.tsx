import type { PortosaurOptions } from "../../../lib/config.ts";

/**
 * Site footer — renders only when `theme.footer.enable` is set.
 *
 * The message renders as HTML (theme-classic rendered the footer
 * copyright as HTML too). The Portosaur credit link inside the
 * default message is added — or omitted when
 * `theme.footer.disable_project_link` is set — by the config engine
 * (`buildSiteConfig`), so this component renders the message as-is.
 */
export function Footer({ config }: { config: PortosaurOptions }) {
  const footer = config.theme.footer;
  if (!footer.enable) {
    return null;
  }
  return (
    <footer className="porto-footer">
      <div
        className="porto-footer__message"
        dangerouslySetInnerHTML={{ __html: footer.message }}
      />
    </footer>
  );
}
