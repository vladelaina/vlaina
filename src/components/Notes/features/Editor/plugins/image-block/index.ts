import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { keymap } from '@milkdown/kit/prose/keymap';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { ImageBlockNodeView } from './ImageBlockNodeView';
import { imageDragPlugin } from './imageDragPlugin';
import { imageAssetLifecyclePlugin } from './imageAssetLifecyclePlugin';

const imageNodeViewPluginKey = new PluginKey('imageNodeViewPlugin');

export const imageNodeViewPlugin = $prose(() => {
    return new Plugin({
        key: imageNodeViewPluginKey,
        props: {
            nodeViews: {
                image: (node: Node, view: EditorView, getPos: () => number | undefined) => {
                    return new ImageBlockNodeView(node, view, getPos);
                }
            }
        }
    });
});

export const imageKeymapPlugin = $prose(() => {
    return keymap({
        'Backspace': (state, dispatch) => {
            const { selection } = state;
            const { $from, empty } = selection;

            if (!empty || $from.parentOffset > 0) return false;
            if ($from.parent.type.name !== 'paragraph') return false;

            const index = $from.index($from.depth - 1);
            const parent = $from.node($from.depth - 1);

            if (index === 0) return false;

            const prevNode = parent.child(index - 1);

            const isPrevImageParagraph = prevNode.type.name === 'paragraph' &&
                prevNode.childCount === 1 &&
                prevNode.firstChild?.type.name === 'image';

            if (isPrevImageParagraph) {
                if (dispatch) {
                    const tr = state.tr;

                    if ($from.parent.content.size === 0) {
                        tr.delete($from.before(), $from.after());
                    } else {
                        return false;
                    }

                    const p2Pos = $from.before();
                    const p1Pos = p2Pos - prevNode.nodeSize;
                    const imagePos = p1Pos + 1;

                    tr.setSelection(NodeSelection.create(state.doc, imagePos));
                    tr.scrollIntoView();

                    dispatch(tr);
                }
                return true;
            }

            return false;
        }
    });
});

export const imageBlockPlugin = [imageNodeViewPlugin, imageAssetLifecyclePlugin, imageKeymapPlugin, imageDragPlugin];

export { setDragState, clearDragState, getDragState, calculateDropPosition } from './imageDragPlugin';
