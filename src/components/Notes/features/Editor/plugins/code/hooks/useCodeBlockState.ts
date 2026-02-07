import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../../../utils/shiki';

interface UseCodeBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useCodeBlockState({ node, view, getPos }: UseCodeBlockStateProps) {
    const language = node.attrs.language || 'text';
    const [copied, setCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);

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
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [node.textContent]);

    const toggleCollapse = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCollapsed(prev => !prev);
    }, []);

    const handleShare = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Placeholder
    }, []);

    // Collapsing Effect
    useEffect(() => {
        // Traverse up: CodeBlockView div -> headerDOM -> code-block-container
        const container = headerRef.current?.parentElement?.parentElement;
        if (container) {
           if (isCollapsed) {
               container.classList.add('collapsed');
               container.style.height = '40px'; 
               container.style.overflow = 'hidden';
           } else {
               container.classList.remove('collapsed');
               container.style.height = '';
               container.style.overflow = '';
           }
        }
    }, [isCollapsed]);

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
