import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../../../utils/shiki';
import { isSelectionFullyInsideNode, moveSelectionAfterNode } from '../codeBlockSelectionUtils';

interface UseCodeBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useCodeBlockState({ node, view, getPos }: UseCodeBlockStateProps) {
    const language = node.attrs.language || 'text';
    const [copied, setCopied] = useState(false);
    const isCollapsed = Boolean(node.attrs.collapsed);
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const copyTimerRef = useRef<number | null>(null);

    const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language);
    const displayName = langInfo ? langInfo.name : language;

    const updateLanguage = useCallback((newLang: string) => {
        const pos = getPos();
        if (pos === undefined) return;
        
        const normalized = normalizeLanguage(newLang) || newLang;

        view.dispatch(
            view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                language: normalized
            })
        );
    }, [view, getPos, node.attrs]);

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const code = node.textContent;
        void navigator.clipboard.writeText(code);
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
        setCopied(true);
        copyTimerRef.current = window.setTimeout(() => {
            setCopied(false);
            copyTimerRef.current = null;
        }, 2000);
    }, [node.textContent]);

    const toggleCollapse = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos === undefined) return;

        const currentNode = view.state.doc.nodeAt(pos);
        if (!currentNode) return;

        const nextCollapsed = !isCollapsed;
        const tr = view.state.tr.setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            collapsed: nextCollapsed,
        });

        if (nextCollapsed) {
            const selection = view.state.selection;
            if (isSelectionFullyInsideNode(selection, pos, currentNode.nodeSize)) {
                moveSelectionAfterNode(tr, pos, currentNode.nodeSize);
            }
        }

        view.dispatch(tr.scrollIntoView());
    }, [getPos, isCollapsed, view]);

    const handleShare = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Placeholder
    }, []);

    // Keep DOM state in sync for styles/behavior tied to collapsed mode.
    useEffect(() => {
        const container = headerRef.current?.parentElement?.parentElement;
        if (container) {
            container.setAttribute('data-collapsed', String(isCollapsed));
        }
    }, [isCollapsed]);

    useEffect(() => {
        return () => {
            if (copyTimerRef.current !== null) {
                window.clearTimeout(copyTimerRef.current);
                copyTimerRef.current = null;
            }
        };
    }, []);

    return {
        language,
        displayName,
        copied,
        isCollapsed,
        isLangMenuOpen,
        setIsLangMenuOpen,
        headerRef,
        updateLanguage,
        handleCopy,
        toggleCollapse,
        handleShare
    };
}
