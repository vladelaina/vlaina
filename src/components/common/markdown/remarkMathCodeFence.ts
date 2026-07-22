import { visit } from 'unist-util-visit';

export function remarkMathCodeFence() {
  return (tree: any) => {
    visit(tree, 'code', (node: any) => {
      if (node.lang?.toLowerCase() !== 'math') return;
      node.type = 'math';
      delete node.lang;
      delete node.meta;
    });
  };
}
