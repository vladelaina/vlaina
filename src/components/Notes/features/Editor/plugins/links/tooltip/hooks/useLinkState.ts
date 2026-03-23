import { useState, useEffect, useMemo, useCallback } from 'react';

export interface UseLinkStateProps {
    href: string;
    initialText?: string;
    onEdit: (text: string, url: string, shouldClose?: boolean) => void;
    onClose: () => void;
}

export function useLinkState({ href, initialText = '', onEdit }: UseLinkStateProps) {
    const isNewLink = !href;
    const [mode, setMode] = useState<'view' | 'edit'>(isNewLink ? 'edit' : 'view');
    const [showCopied, setShowCopied] = useState(false);

    // Detect if this is an autolink (pure URL) vs a Markdown link [text](url)
    const isAutolink = useMemo(() => {
        if (!initialText || initialText.trim() === '') return true;
        return initialText === href || initialText.trim() === href.trim();
    }, [initialText, href]);

    const getInitialEditText = () => {
        if (isAutolink) return '';
        return initialText;
    };

    const [editUrl, setEditUrl] = useState(href);
    const [editText, setEditText] = useState(getInitialEditText);

    useEffect(() => {
        setEditUrl(href);
        setEditText(isAutolink ? '' : initialText);
    }, [href, initialText, isAutolink]);

    // Sync edit mode to parent container
    useEffect(() => {
        const container = document.querySelector('.link-tooltip-container');
        const root = document.documentElement;
        const body = document.body;
        if (container) {
            if (mode === 'edit') {
                container.setAttribute('data-editing', 'true');
                root.setAttribute('data-link-selection-visible', 'true');
                body.setAttribute('data-link-selection-visible', 'true');
            } else {
                container.removeAttribute('data-editing');
                root.removeAttribute('data-link-selection-visible');
                body.removeAttribute('data-link-selection-visible');
            }
        }

        return () => {
            root.removeAttribute('data-link-selection-visible');
            body.removeAttribute('data-link-selection-visible');
        };
    }, [mode]);

    const handleSaveEdit = useCallback((shouldClose: boolean = false) => {
        const isEmptyOrMatchesUrl = !editText.trim() || editText.trim() === editUrl.trim();
        const textToSave = isEmptyOrMatchesUrl ? editUrl : editText;

        const container = document.querySelector('.link-tooltip-container');
        container?.removeAttribute('data-editing');
        document.documentElement.removeAttribute('data-link-selection-visible');
        document.body.removeAttribute('data-link-selection-visible');

        onEdit(textToSave, editUrl, shouldClose);
        if (!shouldClose) {
            setMode('view');
        }
    }, [editText, editUrl, onEdit]);

    const handleCopy = useCallback(() => {
        let copyText: string;
        if (isAutolink) {
            copyText = href;
        } else {
            copyText = `[${initialText}](${href})`;
        }
        navigator.clipboard.writeText(copyText);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    }, [isAutolink, href, initialText]);

    const displayUrl = useMemo(() => {
        try {
            const url = new URL(href);
            const cleanHost = url.hostname.replace(/^www\./, '');
            return cleanHost + (url.pathname.length > 1 && url.pathname !== '/' ? url.pathname : '');
        } catch {
            return href;
        }
    }, [href]);

    return {
        mode, setMode,
        isAutolink,
        editUrl, setEditUrl,
        editText, setEditText,
        handleSaveEdit,
        handleCopy,
        showCopied,
        displayUrl,
        isNewLink
    };
}
