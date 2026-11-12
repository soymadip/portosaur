import { useEffect, useRef } from "react";
import clsx from "clsx";
import { useWindowSize } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import DocItemPaginator from "@theme/DocItem/Paginator";
import DocVersionBanner from "@theme/DocVersionBanner";
import DocVersionBadge from "@theme/DocVersionBadge";
import DocItemFooter from "@theme/DocItem/Footer";
import DocItemTOCDesktop from "@theme/DocItem/TOC/Desktop";
import DocItemContent from "@theme/DocItem/Content";
import DocBreadcrumbs from "@theme/DocBreadcrumbs";
import ContentVisibility from "@theme/ContentVisibility";
import MobileTOC from "../../components/MobileTOC/index.jsx";
import PageActions from "../../components/PageActions/index.jsx";
import pageStyles from "../../components/PageActions/styles.module.css";
import styles from "@docusaurus/theme-classic/lib/theme/DocItem/Layout/styles.module.css";

function MobileToolbar({ children }) {
  const toolbarRef = useRef(null);

  useEffect(() => {
    const navbar = document.querySelector(".navbar--fixed-top");
    const toolbar = toolbarRef.current;

    if (!navbar || !toolbar) {
      return;
    }

    let animationFrame = 0;
    const updateTop = () => {
      const navbarBottom = Math.max(0, navbar.getBoundingClientRect().bottom);
      const navbarReservedHeight = Math.max(navbarBottom, navbar.offsetHeight);
      toolbar.style.setProperty("--mobile-toolbar-top", `${navbarBottom}px`);
      document.documentElement.style.setProperty(
        "--mobile-doc-scroll-offset",
        `${navbarReservedHeight + toolbar.offsetHeight + 8}px`,
      );
    };

    const stopFollowingNavbar = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      updateTop();
    };

    const followNavbar = (event) => {
      if (event.propertyName !== "transform") {
        return;
      }

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      const follow = () => {
        updateTop();
        animationFrame = window.requestAnimationFrame(follow);
      };

      follow();
    };

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(updateTop);
    });
    observer.observe(navbar, { attributes: true, attributeFilter: ["class"] });
    navbar.addEventListener("transitionrun", followNavbar);
    navbar.addEventListener("transitionend", stopFollowingNavbar);
    navbar.addEventListener("transitioncancel", stopFollowingNavbar);
    window.addEventListener("resize", updateTop);
    updateTop();

    return () => {
      observer.disconnect();
      navbar.removeEventListener("transitionrun", followNavbar);
      navbar.removeEventListener("transitionend", stopFollowingNavbar);
      navbar.removeEventListener("transitioncancel", stopFollowingNavbar);
      window.removeEventListener("resize", updateTop);
      stopFollowingNavbar();
      document.documentElement.style.removeProperty(
        "--mobile-doc-scroll-offset",
      );
    };
  }, []);

  return (
    <div
      ref={toolbarRef}
      className={pageStyles.mobileToolbar}
      style={{ "--mobile-toolbar-top": "0px" }}
    >
      {children}
    </div>
  );
}

/**
 * Decide if the toc should be rendered, on mobile or desktop viewports
 */
function useDocTOC() {
  const { frontMatter, toc } = useDoc();
  const windowSize = useWindowSize();
  const hidden = frontMatter.hide_table_of_contents;
  const canRender = !hidden && toc.length > 0;

  const mobile = canRender ? <MobileTOC /> : undefined;

  const desktop =
    canRender && (windowSize === "desktop" || windowSize === "ssr") ? (
      <DocItemTOCDesktop />
    ) : undefined;

  return {
    hidden,
    mobile,
    desktop,
  };
}

export default function DocItemLayout({ children }) {
  const docTOC = useDocTOC();
  const { metadata } = useDoc();
  const windowSize = useWindowSize();
  const showDesktopRightCol = windowSize === "desktop" || windowSize === "ssr";

  return (
    <div className="row">
      <div className={clsx("col", !docTOC.hidden && styles.docItemCol)}>
        <ContentVisibility metadata={metadata} />
        <DocVersionBanner />
        <div className={styles.docItemContainer}>
          <article>
            <DocBreadcrumbs />
            <DocVersionBadge />

            <MobileToolbar>
              <PageActions mobile className={pageStyles.mobileOnly} />
              {docTOC.mobile}
            </MobileToolbar>
            <DocItemContent>{children}</DocItemContent>
            <DocItemFooter />
          </article>
          <DocItemPaginator />
        </div>
      </div>
      {showDesktopRightCol && (
        <div className={clsx("col col--3", pageStyles.desktopRail)}>
          <PageActions className={pageStyles.desktopOnly} />
          {docTOC.desktop}
        </div>
      )}
    </div>
  );
}
