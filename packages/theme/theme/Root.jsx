import BrowserOnly from "@docusaurus/BrowserOnly";
import { PreviewProvider, ViewerWindow } from "./components/Preview/index.jsx";

export default function Root({ children }) {
  return (
    <PreviewProvider>
      {children}
      <BrowserOnly>{() => <ViewerWindow />}</BrowserOnly>
    </PreviewProvider>
  );
}
