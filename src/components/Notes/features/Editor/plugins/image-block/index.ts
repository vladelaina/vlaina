import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { ImageBlockNodeView } from './ImageBlockNodeView';

// Plugin key for identification
const imageNodeViewPluginKey = new PluginKey('imageNodeViewPlugin');

// Create a ProseMirror plugin that attaches a custom NodeView to the 'image' node
export const imageNodeViewPlugin = $prose(() => {
    return new Plugin({
        key: imageNodeViewPluginKey,
        props: {
            nodeViews: {
                // Target the 'image' node from commonmark preset
                image: (node: Node, view: EditorView, getPos: () => number | undefined) => {
                    console.log('[ImageNodeView] Creating view for image:', node.attrs.src);
                    return new ImageBlockNodeView(node, view, getPos);
                }
            }
        }
    });
});

// Export as array for easy spreading in editor config
export const imageBlockPlugin = [imageNodeViewPlugin];
