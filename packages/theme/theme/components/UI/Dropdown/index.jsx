import React, { useState, useRef, useEffect } from "react";
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

  top = false,
  left = false,
  right = false,

  // Button styling props to mirror Btn API
  primary = false,
  secondary = false,
  outline = false,

  size = "md",

  ...buttonProps
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuOffset, setMenuOffset] = useState(0);
  const menuTimer = useRef(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  // Resolve direction string from boolean props
  const direction = top ? "top" : left ? "left" : right ? "right" : "bottom";

  const handleMouseEnter = () => {
    if (menuTimer.current) clearTimeout(menuTimer.current);
    setShowMenu(true);
  };

  const handleMouseLeave = () => {
    menuTimer.current = setTimeout(() => setShowMenu(false), hoverDelay);
  };

  // Edge-aware correction for bottom/top directions — finds nearest scrolling container
  // to handle popups that are smaller than the window.
  useEffect(() => {
    if (!showMenu || !menuRef.current || !containerRef.current) {
      return;
    }
    if (direction !== "bottom" && direction !== "top") {
      setMenuOffset(0);
      return;
    }

    const menuWidth = menuRef.current.offsetWidth;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const padding = 12;

    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const defaultMenuLeft = triggerCenter - menuWidth / 2;
    const defaultMenuRight = triggerCenter + menuWidth / 2;

    // Walk up DOM to find the nearest scrolling/clipping container
    // This ensures correctness inside popups that are narrower than the window.
    let rightBound = window.innerWidth - padding;
    let leftBound = padding;
    let el = containerRef.current.parentElement;

    while (el && el !== document.body) {
      const cs = window.getComputedStyle(el);
      const overflowX = cs.overflowX;

      if (
        overflowX === "auto" ||
        overflowX === "scroll" ||
        overflowX === "hidden"
      ) {
        const r = el.getBoundingClientRect();
        rightBound = Math.min(rightBound, r.right - padding);
        leftBound = Math.max(leftBound, r.left + padding);
        break;
      }
      el = el.parentElement;
    }

    let offset = 0;
    if (defaultMenuLeft < leftBound) {
      offset = leftBound - defaultMenuLeft;
    } else if (defaultMenuRight > rightBound) {
      offset = rightBound - defaultMenuRight;
    }

    setMenuOffset(offset);
  }, [showMenu, direction]);

  // Resolve trigger element: default to a Btn if a string, or if omitted (using label)
  let triggerElement = trigger;
  if (!triggerElement) {
    triggerElement = (
      <Btn
        primary={primary}
        secondary={secondary}
        outline={outline}
        size={size}
        {...buttonProps}
      >
        {label !== undefined ? label : "Menu"}
      </Btn>
    );
  } else if (typeof triggerElement === "string") {
    triggerElement = (
      <Btn
        primary={primary}
        secondary={secondary}
        outline={outline}
        size={size}
        {...buttonProps}
      >
        {triggerElement}
      </Btn>
    );
  }

  const isDefaultOrBtn =
    !trigger || typeof trigger === "string" || triggerElement.type === Btn;
  const arrowClassName =
    `${styles.dropdownArrow} ${isDefaultOrBtn ? styles.dropdownArrowBtn : ""}`.trim();

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
            <span className={arrowClassName} />
          </>
        ),
      })
    : triggerElement;

  return (
    <div
      ref={containerRef}
      className={`${styles.dropdown} ${showMenu ? styles.dropdownShow : ""} ${className}`.trim()}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {enhancedTrigger}

      <div
        ref={menuRef}
        className={styles.dropdownMenu}
        data-direction={direction}
        style={{
          "--menu-offset": `${menuOffset}px`,
        }}
      >
        {items.map((item, idx) => {
          // Separator item — renders a visual divider
          if (item.type === "separator") {
            return <hr key={idx} className={styles.dropdownSeparator} />;
          }

          const {
            id,
            label,
            icon: Icon,
            active,
            onClick,
            href,
            sameTab,
          } = item;

          const Component = href ? Link : "button";
          const linkProps = {};
          if (href) {
            linkProps.to = href;
            if (
              !sameTab &&
              (href.startsWith("http") || href.startsWith("//"))
            ) {
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
