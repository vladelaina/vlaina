import { NodeView, EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { CodeBlockView } from './CodeBlockView';

export class CodeBlockNodeView implements NodeView {
    dom: HTMLElement;
    contentDOM: HTMLElement;
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    root: Root;

    headerDOM: HTMLElement;

    constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;

        this.dom = document.createElement('div');
        this.dom.classList.add('code-block-container', 'my-4', 'rounded-lg', 'border', 'border-[var(--neko-border)]', 'bg-[var(--neko-bg-secondary)]', 'overflow-hidden');
        
        // 1. Header container for React
        this.headerDOM = document.createElement('div');
        this.dom.appendChild(this.headerDOM);

        // 2. Editable content container
        this.contentDOM = document.createElement('pre');
        this.contentDOM.className = 'm-0 p-4 overflow-x-auto text-sm font-mono leading-relaxed bg-transparent outline-none';
        this.dom.appendChild(this.contentDOM);
        
        this.root = createRoot(this.headerDOM);
        this.render();
    }

    render() {
        this.root.render(
            React.createElement(CodeBlockView, {
                node: this.node,
                view: this.view,
                getPos: this.getPos
            })
        );
    }

    update(node: Node) {
        if (node.type !== this.node.type) return false;
        this.node = node;
        // Don't need to full re-render React if content is handled by ProseMirror
        return true;
    }

    stopEvent(event: Event) {
        const target = event.target as HTMLElement;
        if (target.closest('button')) return true;
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
