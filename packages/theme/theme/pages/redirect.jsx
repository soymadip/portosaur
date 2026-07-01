import { useEffect, useState } from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import { MdOpenInNew } from "react-icons/md";
import { Btn } from "../components/UI/index.jsx";

import styles from "../NotFound/styles.module.css";

export default function RedirectPage() {
  const [targetUrl, setTargetUrl] = useState(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");

    if (!url) {
      // No ?url= param — just go home.
      window.location.replace("/");
      return;
    }

    setTargetUrl(url);

    // Try to open in external browser window.
    // Works on Android standalone PWA; returns null on iOS standalone.
    const win = window.open(url, "_blank", "noopener,noreferrer");

    if (win) {
      // Opened successfully — navigate back inside the PWA.
      if (history.length > 1) {
        history.back();
      } else {
        window.location.replace("/");
      }
    } else {
      // window.open() was blocked (iOS standalone PWA).
      // Show a fallback the user can tap manually.
      setBlocked(true);
    }
  }, []);

  return (
    <>
      <PageMetadata title="Opening in browser…" />
      <Layout>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <MdOpenInNew aria-hidden="true" />
          </div>
          <h2 className={styles.emptyTitle}>
            {blocked ? "This page is outside the app" : "Opening in browser…"}
          </h2>
          {blocked && targetUrl && (
            <>
              <p className={styles.emptyDesc}>
                This link lives outside the portfolio app. Tap the button below
                to open it in your browser.
              </p>
              <Btn
                as="a"
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                primary
              >
                Open in browser
              </Btn>
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
