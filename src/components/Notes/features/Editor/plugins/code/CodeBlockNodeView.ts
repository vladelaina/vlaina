import { NodeView, EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { CodeBlockView } from './CodeBlockView';
import {
    createCodeBlockContentKeydownHandler,
    createCodeBlockPasteHandler,
} from './codeBlockNodeViewEvents';

export class CodeBlockNodeView implements NodeView {
    dom: HTMLElement;
    contentDOM: HTMLElement;
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    root: Root;

    headerDOM: HTMLElement;
    private readonly contentKeydownHandler: (event: KeyboardEvent) => void;
    private readonly pasteHandler: (event: ClipboardEvent) => void;

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
        
        // 1. Header container for React
        this.headerDOM = document.createElement('div');
        // Keep header controls non-editable, but let ProseMirror manage the main editable area.
        this.headerDOM.contentEditable = 'false';
        this.dom.appendChild(this.headerDOM);

        this.contentDOM = document.createElement('pre');
        this.contentDOM.className = 'code-block-editable m-0 px-4 pb-4 pt-1 overflow-x-auto text-sm font-mono leading-relaxed bg-transparent outline-none';

        this.contentKeydownHandler = createCodeBlockContentKeydownHandler({
            view: this.view,
            getPos: this.getPos,
            getNode: () => this.node,
        });
        this.pasteHandler = createCodeBlockPasteHandler({
            view: this.view,
        });

        this.contentDOM.addEventListener('keydown', this.contentKeydownHandler);
        this.contentDOM.addEventListener('paste', this.pasteHandler);
        
        this.dom.appendChild(this.contentDOM);
        this.applyCollapsedState();
        
        this.root = createRoot(this.headerDOM);
        this.render();
    }

    private applyCollapsedState() {
        const isCollapsed = Boolean(this.node.attrs.collapsed);
        this.dom.setAttribute('data-collapsed', String(isCollapsed));

        if (isCollapsed) {
            this.contentDOM.style.display = 'none';
            this.contentDOM.setAttribute('aria-hidden', 'true');
            this.contentDOM.tabIndex = -1;
            return;
        }

        this.contentDOM.style.display = '';
        this.contentDOM.removeAttribute('aria-hidden');
        this.contentDOM.removeAttribute('tabindex');
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
        this.applyCollapsedState();
        this.render();
        return true;
    }

    // Only block specific UI interactions
    stopEvent(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return false;
        if (target.closest('button')) return true;
        return false;
    }

    ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) {
        // Always let ProseMirror observe selection changes.
        if (mutation.type === 'selection') return false;

        const target = mutation.target;
        // Changes inside the editable code body must be observed.
        if (this.contentDOM.contains(target)) return false;

        // Header/UI mutations are managed by React and should be ignored by ProseMirror.
        return true;
    }

    destroy() {
        this.contentDOM.removeEventListener('keydown', this.contentKeydownHandler);
        this.contentDOM.removeEventListener('paste', this.pasteHandler);
        this.root.unmount();
        this.dom.remove();
    }
}
