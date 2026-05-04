import { NodeSelection } from '@milkdown/kit/prose/state';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey } from '../cursor/blockSelectionPluginState';

export function selectVideoBlock(view: EditorView, node: ProseMirrorNode, pos: number): void {
  const blockRange = { from: pos, to: pos + node.nodeSize };
  const tr = view.state.tr
    .setSelection(NodeSelection.create(view.state.doc, pos))
    .setMeta(blankAreaDragBoxPluginKey, {
      type: 'set-blocks',
      blocks: [blockRange],
    });
  view.dispatch(tr);
}
