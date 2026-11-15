import Layout from "@theme/Layout";
import NoteCards from "../components/NoteCards/index.jsx";
import { usePluginData } from "@docusaurus/useGlobalData";
import NavArrow from "../components/NavArrow/index.jsx";
import HashNavigation from "../utils/HashNavigation.jsx";

import styles from "../css/notes.module.css";

export default function Notes() {
  const { path: docsBasePath } = usePluginData(
    "docusaurus-plugin-content-docs",
  );
  const pathName = docsBasePath.replace("/", "");
  const pageTitle = pathName.charAt(0).toUpperCase() + pathName.slice(1);

  return (
    <Layout title={pageTitle} description={`My ${pageTitle}`}>
      <style>{`
        :root {
          --ifm-navbar-shadow: none !important;
        }
      `}</style>
      <main className={styles.notesContainer}>
        <div className="container">
          <header className="text-center mb-4">
            <h1 className={styles.pageTitle}>My Notes</h1>
            <p className={styles.pageDescription}>
              A collection of my self written notes &amp; reference guides
            </p>
          </header>
          <NoteCards />
          <NavArrow />

          <HashNavigation
            elementPrefix="note-"
            elementSelector=".note-card"
            effectDuration={6000}
          />
        </div>
      </main>
    </Layout>
  );
}
