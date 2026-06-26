import React from "react";
import Link from "@docusaurus/Link";
import Hint from "../../Hint";
import styles from "./styles.module.css";
import checkDuplicateProps from "../../../utils/checkDuplicateProps.js";

export default function Btn({
  children,
  icon,
  title,
  onClick,
  disabled,
  className = "",
  as,
  href,
  sameTab,

  desc,
  hint,
  hintTop,
  hintRight,
  hintLeft,
  hintBottom,

  primary,
  danger,
  success,
  warning,
  info,
  secondary,

  ...rest
}) {
  checkDuplicateProps("Btn", "variant", {
    primary,
    secondary,
    success,
    warning,
    danger,
    info,
  });

  checkDuplicateProps("Btn", "hint", {
    hint,
    hintTop,
    hintRight,
    hintLeft,
    hintBottom,
  });

  const Component = as || (href ? Link : "button");
  const isDocusaurusLink = Component === Link;
  const linkProps = {};

  if (href) {
    if (isDocusaurusLink) {
      linkProps.to = href;
    } else {
      linkProps.href = href;
    }

    if (!sameTab && (href.startsWith("http") || href.startsWith("//"))) {
      linkProps.target = "_blank";
      linkProps.rel = "noopener noreferrer";
    }
  }

  let variantClass = "";

  if (primary) {
    variantClass = styles.buttonPrimary;
  } else if (danger) {
    variantClass = styles.buttonDanger;
  } else if (success) {
    variantClass = styles.buttonSuccess;
  } else if (warning) {
    variantClass = styles.buttonWarning;
  } else if (info) {
    variantClass = styles.buttonInfo;
  } else if (secondary) {
    variantClass = styles.buttonSecondary;
  }

  const combinedClassName = `${styles.button} ${variantClass} ${
    disabled ? styles.buttonDisabled : ""
  } ${className}`.trim();

  const renderIcon = () => {
    if (!icon) {
      return null;
    }

    if (typeof icon === "string") {
      const isUrl =
        icon.match(/\.(svg|png|jpg|jpeg|gif|webp)$/i) ||
        icon.startsWith("http") ||
        icon.startsWith("/");

      if (isUrl) {
        return <img src={icon} alt="" className={styles.icon} />;
      }

      return (
        <span className={styles.icon} style={{ fontSize: "1em" }}>
          {icon}
        </span>
      );
    }

    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, {
        className: `${icon.props.className || ""} ${styles.icon}`.trim(),
      });
    }

    return null;
  };

  const buttonElement = (
    <Component
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }

        onClick?.(e);
      }}
      disabled={Component === "button" ? disabled : undefined}
      aria-disabled={disabled ? "true" : undefined}
      className={combinedClassName}
      title={title}
      {...linkProps}
      {...rest}
    >
      {renderIcon()}
      {children && <span className={styles.text}>{children}</span>}
    </Component>
  );

  let tooltipMsg = desc;
  const hintProps = {};

  if (!tooltipMsg) {
    if (hint !== undefined || hintTop !== undefined) {
      tooltipMsg = hint ?? hintTop;
    } else if (hintRight !== undefined) {
      tooltipMsg = hintRight;
      hintProps.right = true;
    } else if (hintLeft !== undefined) {
      tooltipMsg = hintLeft;
      hintProps.left = true;
    } else if (hintBottom !== undefined) {
      tooltipMsg = hintBottom;
      hintProps.bottom = true;
    }
  }

  if (tooltipMsg) {
    return (
      <Hint msg={tooltipMsg} noUl gap={10} {...hintProps}>
        {buttonElement}
      </Hint>
    );
  }

  return buttonElement;
}
