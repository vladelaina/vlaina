import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { createOpenMermaidEditorState } from './mermaidEditorState';
import type { MermaidEditorState } from './types';

interface MermaidEditorViewLike {
  state: {
    doc: {
      resolve: (pos: number) => {
        depth: number;
        node: (depth: number) => ProseNode;
        before: (depth: number) => number;
      };
      nodeAt: (pos: number) => ProseNode | null;
    };
  };
}

export function resolveMermaidEditorOpenState(args: {
  view: MermaidEditorViewLike;
  pos: number;
  getPosition: (nodePos: number) => { x: number; y: number };
}): MermaidEditorState | null {
  const { view, pos, getPosition } = args;
  const { state } = view;
  const $pos = state.doc.resolve(pos);
  const node = state.doc.nodeAt(pos);

  if (node?.type.name === 'mermaid') {
    return createOpenMermaidEditorState({
      code: node.attrs.code || '',
      position: getPosition(pos),
      nodePos: pos,
      openSource: 'existing-node',
    });
  }

  for (let depth = $pos.depth; depth > 0; depth--) {
    const parentNode = $pos.node(depth);
    if (parentNode.type.name !== 'mermaid') {
      continue;
    }

    const parentPos = $pos.before(depth);
    return createOpenMermaidEditorState({
      code: parentNode.attrs.code || '',
      position: getPosition(parentPos),
      nodePos: parentPos,
      openSource: 'existing-node',
    });
  }

  return null;
}
