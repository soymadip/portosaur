import MDXComponents from "@theme-init/MDXComponents";
import Details from "@theme/Details";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv } from "./components/Preview";
import Hint from "./components/Hint";
import TopicList from "./components/TopicList";
import Indent from "./components/Indent";

// Make useful Custom Components available by default
export default {
  ...MDXComponents,
  Pv,
  TopicList,
  Details,
  Tabs,
  TabItem,
  Hint,
  Indent,
};
