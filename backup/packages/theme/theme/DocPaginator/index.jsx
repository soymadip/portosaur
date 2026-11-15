import DocPaginator from "@theme-init/DocPaginator";

export default function DocPaginatorWrapper(props) {
  const newProps = { ...props };

  if (newProps.previous?.title === "Notes") {
    newProps.previous = { ...newProps.previous, title: "All Notes" };
  }

  return <DocPaginator {...newProps} />;
}
