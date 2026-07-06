function visit(tree, type, visitor) {
  function walk(node, index, parent) {
    if (node.type === type) {
      const result = visitor(node, index, parent);
      if (typeof result === "number") return result;
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const result = walk(node.children[i], i, node);
        if (typeof result === "number") {
          i = result - 1; // Adjust index based on what visitor returns
        }
      }
    }
  }
  walk(tree, null, null);
}

const { prefixRegexString } = require("../utils/iconPrefixes.cjs");

module.exports = function remarkIconsPlugin() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      const regex = new RegExp(
        `:(${prefixRegexString}):([a-zA-Z0-9-_]+):`,
        "g",
      );

      const matches = [...node.value.matchAll(regex)];
      if (matches.length === 0) return;

      const newNodes = [];
      let lastIndex = 0;

      for (const match of matches) {
        if (match.index > lastIndex) {
          newNodes.push({
            type: "text",
            value: node.value.slice(lastIndex, match.index),
          });
        }

        const prefix = match[1];
        const iconName = match[2];
        const fullId = `${prefix}:${iconName}`;

        newNodes.push({
          type: "mdxJsxTextElement",
          name: "Icon",
          attributes: [
            {
              type: "mdxJsxAttribute",
              name: "id",
              value: fullId,
            },
          ],
          children: [],
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < node.value.length) {
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      parent.children.splice(index, 1, ...newNodes);
      return index + newNodes.length;
    });
  };
};
