import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { toggleCodeBlockCollapsed, updateCodeBlockLanguage } from '../codeBlockTransactions';
import { codeBlockLanguages } from '../codeBlockLanguageLoader';

interface UseCodeBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    getNode: () => Node;
}

export function useCodeBlockState({ node, view, getPos, getNode }: UseCodeBlockStateProps) {
    const language = node.attrs.language || 'txt';
    const [copied, setCopied] = useState(false);
    const isCollapsed = Boolean(node.attrs.collapsed);
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const copyTimerRef = useRef<number | null>(null);

    const langInfo = codeBlockLanguages.find((item) => item.id === language || item.aliases.includes(language));
    const displayName = langInfo ? langInfo.name : language;

    const updateLanguage = useCallback((newLang: string) => {
        const pos = getPos();
        if (pos === undefined) return;

        updateCodeBlockLanguage(view, pos, newLang);
    }, [view, getPos]);

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const code = getNode().textContent;
        void navigator.clipboard.writeText(code);
        if (copyTimerRef.current !== null) {
            window.clearTimeout(copyTimerRef.current);
        }
        setCopied(true);
        copyTimerRef.current = window.setTimeout(() => {
            setCopied(false);
            copyTimerRef.current = null;
        }, 2000);
    }, [getNode]);

    const toggleCollapse = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (pos === undefined) return;

        toggleCodeBlockCollapsed(view, pos, isCollapsed);
    }, [getPos, isCollapsed, view]);

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
        updateLanguage,
        handleCopy,
        toggleCollapse
    };
}
