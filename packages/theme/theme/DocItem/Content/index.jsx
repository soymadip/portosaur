import clsx from "clsx";
import { ThemeClassNames } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Heading from "@theme/Heading";
import MDXContent from "@theme/MDXContent";
import PageTitleActionsContext from "@portosaur/theme/theme/components/PageActions/PageTitleActionsContext.js";
import TopicList from "@portosaur/theme/theme/components/TopicList/index.jsx";

export default function DocItemContentWrapper({ children, mobileToolbar }) {
  const { metadata, frontMatter, contentTitle } = useDoc();
  const syntheticTitle =
    !frontMatter.hide_title && typeof contentTitle === "undefined"
      ? metadata.title
      : null;
  const actionsFollowMarkdownTitle =
    !syntheticTitle && typeof contentTitle !== "undefined";

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, "markdown")}>
      {syntheticTitle && (
        <>
          <Heading as="h1">{syntheticTitle}</Heading>
          {mobileToolbar}
        </>
      )}
      {!syntheticTitle && !actionsFollowMarkdownTitle && mobileToolbar}
      {actionsFollowMarkdownTitle ? (
        <PageTitleActionsContext.Provider
          value={{ title: contentTitle, toolbar: mobileToolbar }}
        >
          <MDXContent>{children}</MDXContent>
        </PageTitleActionsContext.Provider>
      ) : (
        <MDXContent>{children}</MDXContent>
      )}
      <TopicList />
    </div>
  );
}
