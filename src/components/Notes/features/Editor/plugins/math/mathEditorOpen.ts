import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { createOpenMathEditorState } from './mathEditorState';
import type { MathEditorState } from './types';

interface MathEditorViewLike {
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
  nodeDOM?: (pos: number) => Node | null;
}

export function resolveMathEditorOpenState(args: {
  view: MathEditorViewLike;
  pos: number;
  getPosition: (nodePos: number) => { x: number; y: number };
}): MathEditorState | null {
  const { view, pos, getPosition } = args;
  const { state } = view;
  const $pos = state.doc.resolve(pos);
  const node = state.doc.nodeAt(pos);

  if (node?.type.name === 'math_block') {
    return createOpenMathEditorState({
      latex: node.attrs.latex || '',
      displayMode: true,
      position: getPosition(pos),
      nodePos: pos,
      openSource: 'existing-node',
    });
  }

  if (node?.type.name === 'math_inline') {
    return createOpenMathEditorState({
      latex: node.attrs.latex || '',
      displayMode: false,
      position: getPosition(pos),
      nodePos: pos,
      openSource: 'existing-node',
    });
  }

  for (let depth = $pos.depth; depth > 0; depth--) {
    const parentNode = $pos.node(depth);
    if (parentNode.type.name !== 'math_block' && parentNode.type.name !== 'math_inline') {
      continue;
    }

    const parentPos = $pos.before(depth);
    return createOpenMathEditorState({
      latex: parentNode.attrs.latex || '',
      displayMode: parentNode.type.name === 'math_block',
      position: getPosition(parentPos),
      nodePos: parentPos,
      openSource: 'existing-node',
    });
  }

  return null;
}
