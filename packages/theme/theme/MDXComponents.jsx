import MDXComponents from "@theme-original/MDXComponents";
import Details from "@theme/Details";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv, SrcPv } from "./components/Preview";
import Tooltip from "./components/Tooltip";
import TopicList from "./components/TopicList";
import Indent from "./components/Indent";

// Make useful Custom Components available by default
export default {
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
