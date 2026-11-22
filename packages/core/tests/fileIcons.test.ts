import { describe, expect, test } from "bun:test";
import { getFileIcon, getFolderIcon } from "../src/lib/fileIcons.ts";

/**
 * `getFileIcon` / `getFolderIcon` resolve a file or folder
 * name to its auto icon id from techmap, the one name-to-icon
 * database. A file tries its full name, then a marked stem,
 * then its extension; a folder tries its name.
 */

describe("getFileIcon", () => {
  test("resolves extensions through techmap", () => {
    expect(getFileIcon("index.ts")).toBe("si:typescript");
    expect(getFileIcon("main.py")).toBe("si:python");
    expect(getFileIcon("lib.rs")).toBe("si:rust");
    expect(getFileIcon("x.rb")).toBe("si:ruby");
    expect(getFileIcon("Main.java")).toBe("di:java");
    expect(getFileIcon("notes.md")).toBe("md:language-markdown");
    expect(getFileIcon("pic.png")).toBe("lu:file-image");
    expect(getFileIcon("data.sql")).toBe("lu:database");
  });

  test("a stem never shadows the extension unless marked", () => {
    // `app`, `lib`, `notes`, and `x` are all techmap keys — a
    // file named after one still gets its extension's icon.
    expect(getFileIcon("app.tsx")).toBe("si:react");
    expect(getFileIcon("App.vue")).toBe("si:vuedotjs");
    expect(getFileIcon("lib.rs")).toBe("si:rust");
    expect(getFileIcon("x.rb")).toBe("si:ruby");
    expect(getFileIcon("x.php")).toBe("si:php");
  });

  test("resolves marked stems", () => {
    expect(getFileIcon("vite.config.ts")).toBe("si:vite");
    expect(getFileIcon("README.md")).toBe("md:book-open");
    expect(getFileIcon(".env.local")).toBe("lu:key-round");
    expect(getFileIcon("Dockerfile.dev")).toBe("si:docker");
    expect(getFileIcon("Gemfile.lock")).toBe("si:ruby");
    expect(getFileIcon("tsconfig.json")).toBe("si:typescript");
  });

  test("resolves full names first", () => {
    expect(getFileIcon("package.json")).toBe("si:npm");
    expect(getFileIcon("Dockerfile")).toBe("si:docker");
    expect(getFileIcon(".gitignore")).toBe("si:git");
    expect(getFileIcon("LICENSE")).toBe("lu:scale");
    expect(getFileIcon("README")).toBe("md:book-open");
  });

  test("returns undefined when nothing matches", () => {
    expect(getFileIcon("nope.zzz")).toBeUndefined();
    expect(getFileIcon(".hidden")).toBeUndefined();
  });

  test("matches case-insensitively", () => {
    expect(getFileIcon("INDEX.TS")).toBe("si:typescript");
    expect(getFileIcon("Package.JSON")).toBe("si:npm");
  });
});

describe("getFolderIcon", () => {
  test("resolves folder names", () => {
    expect(getFolderIcon("src")).toBe("lu:folder-code");
    expect(getFolderIcon("docs")).toBe("lu:book-open");
    expect(getFolderIcon("tests")).toBe("lu:flask-conical");
    expect(getFolderIcon("node_modules")).toBe("lu:package");
  });

  test("a folder named after a tech or topic gets that icon", () => {
    expect(getFolderIcon("python")).toBe("si:python");
    expect(getFolderIcon("docker")).toBe("si:docker");
    expect(getFolderIcon("blog")).toBe("md:pencil");
    expect(getFolderIcon("css")).toBe("si:css3");
  });

  test("returns undefined when nothing matches", () => {
    expect(getFolderIcon("random-name")).toBeUndefined();
  });

  test("matches case-insensitively", () => {
    expect(getFolderIcon("SRC")).toBe("lu:folder-code");
  });
});
