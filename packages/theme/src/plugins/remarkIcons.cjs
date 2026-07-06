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

const { getPrefixRegex } = require("../utils/iconPrefixes.cjs");
const prefixRegexString = getPrefixRegex();

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
          let betweenText = node.value.slice(lastIndex, match.index);
          newNodes.push({
            type: "text",
            value: betweenText,
          });
        }

        const prefix = match[1];
        const iconName = match[2];
        const fullId = `${prefix}:${iconName}`;

        let hasTrailingSpace = false;
        const nextIndex = match.index + match[0].length;
        if (node.value[nextIndex] === " ") {
          hasTrailingSpace = true;
        }

        const attributes = [
          {
            type: "mdxJsxAttribute",
            name: "id",
            value: fullId,
          },
        ];

        if (hasTrailingSpace) {
          attributes.push({
            type: "mdxJsxAttribute",
            name: "addSpace",
            value: "true",
          });
        }

        newNodes.push({
          type: "mdxJsxTextElement",
          name: "Icon",
          attributes,
          children: [],
        });

        lastIndex = nextIndex;

        if (hasTrailingSpace) {
          lastIndex++; // skip the space!
        }
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
