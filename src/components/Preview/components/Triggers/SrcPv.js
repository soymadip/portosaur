import React, { useMemo } from "react";
import Pv, { normalizeSources } from "./Pv";
import styles from "../../styles.module.css";

/**
 * --- Footer source list: <SrcPv sources={[...]} /> ---
 * Now refactored to use the Pv component internally for consistency.
 */
export default function SrcPv(props) {
  const { prefixText = "Source file: " } = props;
  const srcList = useMemo(() => normalizeSources(props), [props]);

  if (srcList.length === 0) return null;

  return (
    <div className={styles.sourceFooter}>
      <span className={styles.sourceFooterLabel}>{prefixText}</span>
      {srcList.map((src, idx) => (
        <React.Fragment key={idx}>
          <Pv 
            {...props} 
            sources={srcList} 
            activeIdx={idx}
          >
            {src.label}
          </Pv>
          {idx < srcList.length - 1 ? ", " : ""}
        </React.Fragment>
      ))}
    </div>
  );
}
