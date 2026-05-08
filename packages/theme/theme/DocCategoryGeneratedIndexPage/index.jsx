import DocCategoryGeneratedIndexPage from "@theme-original/DocCategoryGeneratedIndexPage";
import NoteCards from "@portosaur/theme/theme/components/NoteIndex/index.jsx";

export default function DocCategoryGeneratedIndexPageWrapper(props) {
  if (props.categoryGeneratedIndex?.title === "Notes") {
    return <NoteCards />;
  }
  return <DocCategoryGeneratedIndexPage {...props} />;
}
