import { Children, isValidElement, useContext } from "react";
import MDXComponents from "@theme-init/MDXComponents";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import { Pv } from "./components/Preview";
import Hint from "./components/Hint";
import TopicList from "./components/TopicList";
import Indent from "./components/Indent";
import { Btn, Dropdown } from "./components/UI";
import Icon, { IconSearch, DynamicIcon } from "./components/Icon";
import PageTitleActionsContext from "./components/PageActions/PageTitleActionsContext.js";

function getTextContent(children) {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      return isValidElement(child) ? getTextContent(child.props.children) : "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function HeadingWithPageActions(props) {
  const pageTitleActions = useContext(PageTitleActionsContext);
  const HeadingComponent = MDXComponents.h1;
  const isPageTitle =
    pageTitleActions &&
    getTextContent(props.children) === pageTitleActions.title;

  return (
    <>
      <HeadingComponent {...props} />
      {isPageTitle && pageTitleActions.toolbar}
    </>
  );
}

// Make useful Custom Components available by default
export default {
  ...MDXComponents,
  h1: HeadingWithPageActions,
  Pv,
  TopicList,
  Tabs,
  TabItem,
  Hint,
  Indent,
  Btn,
  Dropdown,
  Icon,
  IconSearch,
  DynamicIcon,
};
