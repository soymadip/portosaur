import { useState, useEffect, useRef } from "react";
import Icon from "../index.jsx";
import { Dropdown } from "../../UI";
import styles from "./styles.module.css";
import { iconPacks } from "../../../../src/utils/iconPrefixes.cjs";

const PREFIXES = Object.keys(iconPacks).join(",");

const PREFIX_OPTIONS = [
  { label: "All", value: "all" },
  ...Object.entries(iconPacks).map(([canonical, data]) => ({
    label: data.name,
    value: canonical,
  })),
];

// Reverse map: canonical -> primary shorthand (e.g. "lucide" -> "lu")
const getShorthand = (canonical) => {
  return iconPacks[canonical]?.shorthands[0] || canonical;
};

export default function IconSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const activePrefixes = filter === "all" ? PREFIXES : filter;
        const res = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(
            query,
          )}&prefixes=${activePrefixes}&limit=60`,
        );
        const data = await res.json();
        setResults(data.icons || []);
      } catch (err) {
        console.error("Failed to fetch icons", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query, filter]);

  const copyToClipboard = (iconId) => {
    const [prefix, name] = iconId.split(":");
    const shorthand = getShorthand(prefix);
    const shortcode = `${shorthand}:${name}`;
    navigator.clipboard.writeText(shortcode).then(() => {
      setCopiedId(iconId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const renderIconLabel = (iconId) => {
    const [prefix, name] = iconId.split(":");
    return `${getShorthand(prefix)}:${name}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <Icon id="lu:search" className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search icons (e.g. 'book', 'arrow')..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
        />
        {loading && (
          <Icon id="ml:loading-loop" className={styles.loadingIcon} />
        )}

        {query && !loading && (
          <span className={styles.matchCount}>{results.length} matches</span>
        )}

        <Dropdown
          label={PREFIX_OPTIONS.find((o) => o.value === filter)?.label || "All"}
          items={PREFIX_OPTIONS.map((opt) => ({
            label: opt.label,
            onClick: () => setFilter(opt.value),
            active: filter === opt.value,
          }))}
          size="sm"
          className={styles.filterDropdown}
        />
      </div>

      {results.length > 0 && (
        <div className={styles.resultsList}>
          {results.map((iconId) => (
            <button
              key={iconId}
              className={styles.iconRow}
              onClick={() => copyToClipboard(iconId)}
              title={`Copy ${renderIconLabel(iconId)}`}
            >
              <div className={styles.iconPreview}>
                <Icon id={iconId} />
              </div>
              <div
                className={`${styles.iconName} ${copiedId === iconId ? styles.copiedText : ""}`}
              >
                {copiedId === iconId ? "Copied!" : renderIconLabel(iconId)}
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div className={styles.emptyState}>No icons found for "{query}"</div>
      )}
    </div>
  );
}
