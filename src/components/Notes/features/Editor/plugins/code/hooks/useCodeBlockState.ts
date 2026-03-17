import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { SUPPORTED_LANGUAGES } from '../../../utils/shiki';
import { toggleCodeBlockCollapsed, updateCodeBlockLanguage } from '../codeBlockTransactions';

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

        updateCodeBlockLanguage(view, pos, node.attrs, newLang);
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

        toggleCodeBlockCollapsed(view, pos, isCollapsed);
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
