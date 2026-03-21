import { visit } from "unist-util-visit";
type Root = any;
type RootContent = any;

export default function remarkCitationParser() {
  return (tree: Root) => {
    visit(tree, "text", (node: any, index: any, parent: any) => {
      const regex = /【(\d+)†L(\d+)-L(\d+)】/g;
      let match;
      let last = 0;
      const pieces: RootContent[] = [];

      while ((match = regex.exec(node.value))) {
        if (match.index > last) {
          pieces.push({
            type: "text",
            value: node.value.slice(last, match.index),
          });
        }
        pieces.push({
          type: "custom-citation" as const,
          data: {
            hName: "ol-citation",
            hProperties: {
              cursor: match[1],
              start: match[2],
              end: match[3],
            },
          },
        });
        last = match.index + match[0].length;
      }

      const remaining = node.value.slice(last);
      const generic = /【(\d+)†[^】]*】/g;
      let gLast = 0;
      while ((match = generic.exec(remaining))) {
        if (match.index > gLast) {
          pieces.push({
            type: "text",
            value: remaining.slice(gLast, match.index),
          });
        }
        pieces.push({
          type: "custom-citation" as const,
          data: {
            hName: "ol-citation",
            hProperties: {
              cursor: match[1],
            },
          },
        });
        gLast = match.index + match[0].length;
      }

      if (gLast < remaining.length) {
        pieces.push({ type: "text", value: remaining.slice(gLast) });
      }

      if (pieces.length) {
        parent?.children?.splice(index ?? 0, 1, ...pieces);
        return (index ?? 0) + pieces.length;
      }
    });

    visit(tree, (node, index, parent) => {
      if (
        parent &&
        parent.children &&
        index !== null &&
        index !== undefined &&
        index > 0
      ) {
        const currentNode = node as any;
        const prevNode = parent.children[index - 1] as any;

        if (
          currentNode.type === "custom-citation" &&
          prevNode.type === "custom-citation" &&
          currentNode.data?.hProperties?.cursor ===
            prevNode.data?.hProperties?.cursor
        ) {
          parent.children.splice(index, 1);
          return index;
        }
      }
    });
  };
}
