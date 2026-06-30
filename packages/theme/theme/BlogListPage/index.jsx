import {
  HtmlClassNameProvider,
  ThemeClassNames,
  PageMetadata,
} from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import BlogLayout from "@theme/BlogLayout";
import BlogListPaginator from "@theme/BlogListPaginator";
import BlogPostItems from "@theme/BlogPostItems";
import SearchMetadata from "@theme/SearchMetadata";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import clsx from "clsx";
import { FaPenNib } from "react-icons/fa";

import styles from "./styles.module.css";
import NotifyButton from "./NotifyButton.jsx";

function EmptyBlog() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <FaPenNib aria-hidden="true" />
      </div>
      <h2 className={styles.emptyTitle}>No posts yet</h2>
      <p className={styles.emptyDesc}>
        Check back later — new posts are on the way!
      </p>
    </div>
  );
}

function BlogListPageMetadata({ metadata }) {
  const {
    siteConfig: { title: siteTitle },
  } = useDocusaurusContext();
  const { blogDescription, blogTitle, permalink } = metadata;
  const isBlogOnlyMode = permalink === "/";
  const title = isBlogOnlyMode ? siteTitle : blogTitle;
  return (
    <>
      <PageMetadata title={title} description={blogDescription} />
      <SearchMetadata tag="blog_posts_list" />
    </>
  );
}

function BlogListPageContent({ metadata, items, sidebar }) {
  const {
    siteConfig: { customFields },
  } = useDocusaurusContext();
  const isPwaEnabled = customFields?.pwa?.enable;
  const isNotificationsEnabled = customFields?.pwa?.notifications;

  if (items.length === 0) {
    return (
      <Layout>
        <EmptyBlog />
      </Layout>
    );
  }

  return (
    <BlogLayout sidebar={sidebar}>
      {isPwaEnabled && isNotificationsEnabled && <NotifyButton />}
      <BlogPostItems items={items} />
      <BlogListPaginator metadata={metadata} />
    </BlogLayout>
  );
}

export default function BlogListPage(props) {
  return (
    <HtmlClassNameProvider
      className={clsx(
        ThemeClassNames.wrapper.blogPages,
        ThemeClassNames.page.blogListPage,
      )}
    >
      <BlogListPageMetadata {...props} />
      <BlogListPageContent {...props} />
    </HtmlClassNameProvider>
  );
}
