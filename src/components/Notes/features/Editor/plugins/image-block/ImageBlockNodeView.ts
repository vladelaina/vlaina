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

    // Critical for interactive components inside NodeView
    // Returns true if the event should be handled by the NodeView entirely
    // and NOT passed to ProseMirror's editor state.
    stopEvent(event: Event) {
        const target = event.target as HTMLElement;
        
        // Block ProseMirror drag/selection for:
        // 1. Sliders (.premium-slider and its children)
        // 2. Inputs (Captions, etc)
        // 3. Buttons (Toolbar actions)
        // 4. Any element explicitly marked with data-no-drag
        if (
            target.closest('.premium-slider') || 
            target.closest('input') || 
            target.closest('button') ||
            target.closest('[data-no-drag]')
        ) {
            return true;
        }
        
        return false;
    }

    ignoreMutation() {
        return true;
    }

    destroy() {
        this.root.unmount();
        this.dom.remove();
    }
}
