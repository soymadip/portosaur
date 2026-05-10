import OriginalRoot from "@theme-original/Root";
import { PreviewProvider, ViewerWindow } from "@site/src/components/Preview";

/**
 * Wraps Docusaurus's original Root (which provides ColorModeProvider, etc.)
 * so that PreviewViewer has access to all theme-level React contexts.
 *
 * Tree structure:
 *   <PreviewProvider>         ← our global state (no Docusaurus hooks)
 *     <OriginalRoot>          ← provides ColorModeProvider, etc.
 *       {children}            ← the full Docusaurus app
 *       <PreviewViewer />     ← inside ColorModeProvider ✓
 *     </OriginalRoot>
 *   </PreviewProvider>
 */
export default function Root({ children }) {
  return (
    <PreviewProvider>
      <OriginalRoot>
        {children}
        <ViewerWindow />
      </OriginalRoot>
    </PreviewProvider>
  );
}
