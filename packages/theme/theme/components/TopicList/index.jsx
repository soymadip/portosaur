import DocCardList from "@theme/DocCardList";
import { useCurrentSidebarCategory } from "@docusaurus/plugin-content-docs/client";

// List Topics inside Individual Notes
export default function TopicList({
  children,
  description = "Click on the links below to explore the topics.",
  style = {
    marginTop: "-2.5rem",
    marginBottom: "2.5rem",
    textAlign: "center",
  },
}) {
  let items;
  try {
    const category = useCurrentSidebarCategory();
    items = category.items;
  } catch (e) {
    // Fallback if not on a category page
  }

  return (
    <>
      <br />
      {(children || description) && (
        <p style={style}>{children || description}</p>
      )}
      <DocCardList items={items} />
    </>
  );
}
