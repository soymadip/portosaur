import MDXComponents from "@theme-original/MDXComponents";
import Details from "@theme/Details";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv, SrcPv } from "./components/Preview/index.jsx";
import Tooltip from "./components/Tooltip/index.jsx";
import TopicList from "./components/TopicList/index.jsx";
import Indent from "./components/Indent/index.jsx";

// Make useful Custom Components available by default
const components = {
  ...MDXComponents,
  Pv,
  SrcPv,
  TopicList,
  Details,
  Tabs,
  TabItem,
  Tooltip,
  Indent,
};

export default components;
