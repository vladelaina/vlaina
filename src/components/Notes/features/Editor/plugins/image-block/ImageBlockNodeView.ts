import { NodeView, EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ImageBlockView } from './ImageBlockView';
import { themeImageBlockStyleTokens } from '@/styles/themeTokens';

export class ImageBlockNodeView implements NodeView {
    dom: HTMLElement;
    contentDOM?: HTMLElement;
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    root: Root;
    private dragStartHandler: (e: DragEvent) => void;

    constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;

        this.dom = document.createElement('div');
        this.dom.classList.add('image-block-container', 'md-image', 'image-embed');
        this.dom.contentEditable = 'false';
        this.dom.draggable = false;
        this.dom.style.display = themeImageBlockStyleTokens.displayBlock;
        this.dom.style.width = themeImageBlockStyleTokens.widthFull;
        this.dom.style.maxWidth = themeImageBlockStyleTokens.maxWidthFull;
        this.syncDomAttrs();

        this.dragStartHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.dom.addEventListener('dragstart', this.dragStartHandler, true);

        this.root = createRoot(this.dom);
        this.render();
    }

    private syncDomAttrs() {
        const src = typeof this.node.attrs.src === 'string' ? this.node.attrs.src : '';
        const align = typeof this.node.attrs.align === 'string' ? this.node.attrs.align : '';
        const width = typeof this.node.attrs.width === 'string' ? this.node.attrs.width : '';
        const alt = typeof this.node.attrs.alt === 'string' ? this.node.attrs.alt : '';
        const title = typeof this.node.attrs.title === 'string' ? this.node.attrs.title : '';
        if (src) {
            this.dom.dataset.src = src;
            this.dom.setAttribute('src', src);
            this.dom.setAttribute('data-inject-url', src);
        } else {
            delete this.dom.dataset.src;
            this.dom.removeAttribute('src');
            this.dom.removeAttribute('data-inject-url');
        }

        if (align) {
            this.dom.dataset.align = align;
            this.dom.setAttribute('align', align);
        } else {
            delete this.dom.dataset.align;
            this.dom.removeAttribute('align');
        }

        if (width) {
            this.dom.dataset.width = width;
            this.dom.setAttribute('width', width);
        } else {
            delete this.dom.dataset.width;
            this.dom.removeAttribute('width');
        }

        if (alt) {
            this.dom.dataset.alt = alt;
        } else {
            delete this.dom.dataset.alt;
        }

        if (title) {
            this.dom.dataset.title = title;
            this.dom.setAttribute('title', title);
        } else {
            delete this.dom.dataset.title;
            this.dom.removeAttribute('title');
        }
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
        this.syncDomAttrs();
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
        this.dom.removeEventListener('dragstart', this.dragStartHandler, true);
        queueMicrotask(() => {
            this.root.unmount();
        });
        this.dom.remove();
    }
}
