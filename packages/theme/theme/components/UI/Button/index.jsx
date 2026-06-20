import React from "react";
import Link from "@docusaurus/Link";
import Hint from "../../Hint";
import styles from "./styles.module.css";

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
  primary,
  danger,
  success,
  warning,
  info,
  secondary,
  ...rest
}) {
  const Component = as || (href ? Link : "button");
  const linkProps = {};

  if (href) {
    linkProps.to = href;
    if (!sameTab && (href.startsWith("http") || href.startsWith("//"))) {
      linkProps.target = "_blank";
      linkProps.rel = "noopener noreferrer";
    }
  }

  let variantClass = "";

  if (primary) variantClass = styles.buttonPrimary;
  else if (danger) variantClass = styles.buttonDanger;
  else if (success) variantClass = styles.buttonSuccess;
  else if (warning) variantClass = styles.buttonWarning;
  else if (info) variantClass = styles.buttonInfo;
  else if (secondary) variantClass = styles.buttonSecondary;

  const combinedClassName =
    `${styles.button} ${variantClass} ${disabled ? styles.buttonDisabled : ""} ${className}`.trim();

  const renderIcon = () => {
    if (!icon) return null;

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
        if (onClick) onClick(e);
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

  const tooltipMsg = desc || hint;
  if (tooltipMsg) {
    return (
      <Hint msg={tooltipMsg} noUl gap={10}>
        {buttonElement}
      </Hint>
    );
  }

  return buttonElement;
}
