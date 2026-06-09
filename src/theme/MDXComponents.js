import MDXComponents from "@theme-original/MDXComponents";
import Details from "@theme/Details";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

import { Pv, SrcPv } from "@site/src/components/Preview";
import Tooltip from "@site/src/components/Tooltip";
import NoteCards, { TopicList } from "@site/src/components/NoteIndex";
import Indent from "@site/src/components/Indent";

export default {
  ...MDXComponents,
  Pv,
  SrcPv,
  TopicList,
  NoteCards,
  Details,
  Tabs,
  TabItem,
  Tooltip,
  Indent,
};
