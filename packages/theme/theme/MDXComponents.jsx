import MDXComponents from "@theme-init/MDXComponents";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv } from "./components/Preview";
import Hint from "./components/Hint";
import TopicList from "./components/TopicList";
import Indent from "./components/Indent";
import { Btn, Dropdown } from "./components/UI";
import Icon from "./components/Icon";

// Make useful Custom Components available by default
export default {
  ...MDXComponents,
  Pv,
  TopicList,
  Tabs,
  TabItem,
  Hint,
  Indent,
  Btn,
  Dropdown,
  Icon,
};
