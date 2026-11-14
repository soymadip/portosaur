/**
 * The MDX component map, passed as `components` when rendering MDX
 * content (`<Content components={mdxComponents} />`). Phase 2 stubs —
 * every tag the docs and playground content uses must be present or the
 * MDX build fails. The real implementations land in Phase 4.
 */

import Btn from "./Btn.astro";
import Pv from "./Pv.astro";
import Icon from "./Icon.astro";
import DynamicIcon from "./DynamicIcon.astro";
import IconSearch from "./IconSearch.astro";
import Hint from "./Hint.astro";
import Indent from "./Indent.astro";
import Dropdown from "./Dropdown.astro";
import Details from "./Details.astro";
import Tabs from "./Tabs.astro";
import TabItem from "./TabItem.astro";
import Link from "./Link.astro";
import TopicList from "./TopicList.astro";

export const mdxComponents = {
  Btn,
  Pv,
  Icon,
  DynamicIcon,
  IconSearch,
  Hint,
  Indent,
  Dropdown,
  Details,
  Tabs,
  TabItem,
  Link,
  TopicList,
};
