import React, { useState, useRef } from "react";
import Link from "@docusaurus/Link";
import Btn from "../Button";
import styles from "./styles.module.css";

export default function Dropdown({
  trigger,
  label,
  items = [],
  hoverDelay = 150,
  className = "",
  style,
  ...buttonProps
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuTimer = useRef(null);

  const handleMouseEnter = () => {
    if (menuTimer.current) clearTimeout(menuTimer.current);
    setShowMenu(true);
  };

  const handleMouseLeave = () => {
    menuTimer.current = setTimeout(() => setShowMenu(false), hoverDelay);
  };

  // Resolve trigger element: default to a Btn if a string, or if omitted (using label)
  let triggerElement = trigger;
  if (!triggerElement) {
    triggerElement = <Btn {...buttonProps}>{label || "Menu"}</Btn>;
  } else if (typeof triggerElement === "string") {
    triggerElement = <Btn {...buttonProps}>{triggerElement}</Btn>;
  }

  // Enhance the trigger component with the dropdown arrow and click toggle
  const enhancedTrigger = React.isValidElement(triggerElement)
    ? React.cloneElement(triggerElement, {
        onClick: (e) => {
          if (triggerElement.props.onClick) triggerElement.props.onClick(e);
          setShowMenu(!showMenu);
        },
        children: (
          <>
            {triggerElement.props.children}
            <span className={styles.dropdownArrow} />
          </>
        ),
      })
    : triggerElement;

  return (
    <div
      className={`${styles.dropdown} ${showMenu ? styles.dropdownShow : ""} ${className}`.trim()}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {enhancedTrigger}

      <div className={styles.dropdownMenu}>
        {items.map((item, idx) => {
          const {
            id,
            label,
            icon: Icon,
            active,
            onClick,
            href,
            newTab = true,
          } = item;
          const Component = href ? Link : "button";
          const linkProps = {};
          if (href) {
            linkProps.to = href;
            if (newTab && (href.startsWith("http") || href.startsWith("//"))) {
              linkProps.target = "_blank";
              linkProps.rel = "noopener noreferrer";
            }
          }
          return (
            <Component
              key={id || idx}
              onClick={(e) => {
                if (onClick) onClick(e);
                setShowMenu(false);
              }}
              className={`${styles.dropdownMenuItem} ${
                active ? styles.dropdownMenuItemActive : ""
              }`}
              {...linkProps}
            >
              {Icon &&
                (() => {
                  if (typeof Icon === "string") {
                    const isUrl =
                      Icon.match(/\.(svg|png|jpg|jpeg|gif|webp)$/i) ||
                      Icon.startsWith("http") ||
                      Icon.startsWith("/");
                    if (isUrl) {
                      return (
                        <img
                          src={Icon}
                          alt=""
                          style={{
                            width: "16px",
                            height: "16px",
                            objectFit: "contain",
                          }}
                        />
                      );
                    }
                    return (
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                        }}
                      >
                        {Icon}
                      </span>
                    );
                  }
                  if (React.isValidElement(Icon)) {
                    return React.cloneElement(Icon, {
                      style: {
                        width: "16px",
                        height: "16px",
                        ...Icon.props.style,
                      },
                    });
                  }
                  return <Icon style={{ width: "16px", height: "16px" }} />;
                })()}
              {label}
            </Component>
          );
        })}
      </div>
    </div>
  );
}
