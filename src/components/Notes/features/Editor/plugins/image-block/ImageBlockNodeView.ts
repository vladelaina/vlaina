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
        this.dom.contentEditable = 'false';
        this.dom.draggable = false;

        this.dom.addEventListener('dragstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true);

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

    stopEvent(event: Event) {
        if (event.type.startsWith('pointer') || event.type.startsWith('mouse') || event.type === 'dragstart') {
            const target = event.target as HTMLElement;
            if (target.closest('[data-dragging="true"]')) {
                return true;
            }
        }

        const target = event.target as HTMLElement;

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
