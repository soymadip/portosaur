import TopicList from "@portosaur/theme/theme/components/TopicList/index.jsx";

export default function DocCardListWrapper(props) {
  return <TopicList forceRender={true} items={props.items} className={props.className} />;
}
