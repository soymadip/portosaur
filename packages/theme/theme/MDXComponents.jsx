import MDXComponents from "@theme-original/MDXComponents";
import Details from "@theme/Details";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv, SrcPv } from "./components/Preview/index.js";
import Tooltip from "./components/Tooltip/index.js";
import NoteCards, { TopicList } from "./components/NoteIndex/index.js";
const components = {
  ...MDXComponents,
  Pv,
  SrcPv,
  TopicList,
  NoteCards,
  Details,
  Tabs,
  TabItem,
  Tooltip,
};
export default components;
