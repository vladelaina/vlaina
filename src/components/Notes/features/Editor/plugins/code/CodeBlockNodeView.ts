import { NodeView, EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
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
        this.dom.classList.add(
            'code-block-container', 
            'my-4', 
            'rounded-xl', 
            'border', 
            'border-gray-200', 
            'dark:border-zinc-800', 
            'bg-white', 
            'dark:bg-[#1e1e1e]', 
            'overflow-hidden', 
            'group/code',
            'transition-all'
        );
        // Prevent cursor from entering the UI parts
        this.dom.contentEditable = 'false';
        
        // 1. Header container for React
        this.headerDOM = document.createElement('div');
        this.dom.appendChild(this.headerDOM);

        // 2. Editable content container
        this.contentDOM = document.createElement('pre');
        this.contentDOM.contentEditable = 'true';
        this.contentDOM.className = 'code-block-editable m-0 px-4 pb-4 pt-1 overflow-x-auto text-sm font-mono leading-relaxed bg-transparent outline-none';
        
        // Handle Ctrl+A to select all code in the block
        this.contentDOM.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                e.stopPropagation();
                
                const pos = this.getPos();
                if (pos === undefined) return;
                
                // Update ProseMirror selection
                const start = pos + 1; // +1 to skip the node itself
                const end = pos + this.node.nodeSize - 1; // -1 to stay inside the node
                
                const tr = this.view.state.tr.setSelection(
                    TextSelection.create(this.view.state.doc, start, end)
                );
                this.view.dispatch(tr);
                this.view.focus();
            }
        });
        
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
        this.render();
        return true;
    }

    // Only block specific UI interactions
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