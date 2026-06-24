import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import { FaMapSigns } from "react-icons/fa";
import { Btn } from "../components/UI/index.jsx";

import styles from "./styles.module.css";

export default function NotFound() {
  return (
    <>
      <PageMetadata title="Page Not Found" />
      <Layout>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FaMapSigns aria-hidden="true" />
          </div>
          <h2 className={styles.emptyTitle}>Page Not Found</h2>
          <p className={styles.emptyDesc}>
            The page you're looking for doesn't exist, has been moved, or is
            currently unavailable.
          </p>
          <Btn href="/" primary>
            Go back home
          </Btn>
        </div>
      </Layout>
    </>
  );
}
