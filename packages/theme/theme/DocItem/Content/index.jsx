import ContentOriginal from "@theme-init/DocItem/Content";
import TopicList from "@portosaur/theme/theme/components/TopicList/index.jsx";

export default function DocItemContentWrapper(props) {
  return (
    <>
      <ContentOriginal {...props} />
      <TopicList />
    </>
  );
}
