import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import Icon from "@theme/components/Icon";
import { Btn } from "../components/UI/index.jsx";

import styles from "../NotFound/styles.module.css";

export default function OfflinePage() {
  return (
    <>
      <PageMetadata title="You're Offline" />
      <Layout>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon
              id="line-md:cloud-alt-off-loop"
              aria-hidden="true"
              size="5rem"
            />
          </div>
          <h2 className={styles.emptyTitle}>You're Offline</h2>
          <p className={styles.emptyDesc}>
            It looks like you don't have an internet connection. Previously
            visited pages are still available from cache.
          </p>
          <Btn onClick={() => window.location.reload()} primary>
            Try again
          </Btn>
        </div>
      </Layout>
    </>
  );
}
