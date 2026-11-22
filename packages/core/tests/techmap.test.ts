import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { iconExists } from "../src/lib/icon-data.ts";
import { techMap } from "../src/lib/techmap.ts";

/**
 * `techmap` is the one name-to-icon database for the whole
 * site (icon guessing, card colors, FileTree auto icons), so
 * its contents get their own guards: no key may appear twice
 * (a later duplicate silently shadows the earlier entry), and
 * every icon id must exist in the bundled packs (a missing id
 * renders a blank slot).
 */

describe("techMap", () => {
  test("has no duplicate keys", () => {
    const source = fs.readFileSync(
      new URL("../src/lib/techmap.ts", import.meta.url),
      "utf-8",
    );
    const keys = [
      ...source.matchAll(/^\s{2}(?:"([^"]+)"|([\w$]+)):\s*\{/gm),
    ].map((match) => match[1] ?? match[2]);
    // The regex found every key the module holds.
    expect(keys.length).toBe(Object.keys(techMap).length);
    const seen = new Set<string>();
    const duplicates = keys.filter((key) => {
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
      return false;
    });
    expect(duplicates).toEqual([]);
  });

  test("every icon id exists in the bundled packs", () => {
    const missing = [
      ...new Set(Object.values(techMap).map((entry) => entry.icon)),
    ].filter((id) => !iconExists(id));
    expect(missing).toEqual([]);
  });

  test("every entry has an icon and a color", () => {
    for (const [key, entry] of Object.entries(techMap)) {
      expect(entry.icon, key).not.toBe("");
      expect(entry.color, key).not.toBe("");
    }
  });
});
