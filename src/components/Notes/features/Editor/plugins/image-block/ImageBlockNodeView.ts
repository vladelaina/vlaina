import { NodeView, EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ImageBlockView } from './ImageBlockView';

export class ImageBlockNodeView implements NodeView {
    dom: HTMLElement;
    contentDOM?: HTMLElement;
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    root: Root;

    constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;

        this.dom = document.createElement('div');
        this.dom.classList.add('image-block-container');
        // Prevent ProseMirror off-limits issues when clicking inside
        this.dom.contentEditable = 'false';

        this.root = createRoot(this.dom);
        this.render();
    }

    render() {
        this.root.render(
            React.createElement(ImageBlockView, {
                node: this.node,
                view: this.view,
                getPos: this.getPos
            })
        );
    }

    update(node: Node) {
        if (node.type !== this.node.type) return false;
        this.node = node;
        this.render();
        return true;
    }

    ignoreMutation() {
        return true;
    }

    destroy() {
        this.root.unmount();
        this.dom.remove();
    }
}
