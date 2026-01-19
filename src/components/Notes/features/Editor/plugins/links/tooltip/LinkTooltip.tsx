import React, { useState, useEffect } from 'react';
import { Copy, Edit2, Check, Trash2, Unlink, ExternalLink } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export interface LinkTooltipProps {
    href: string;
    initialText?: string;
    onEdit: (text: string, url: string, shouldClose?: boolean) => void;
    onUnlink: () => void;
    onRemove: () => void;
    onClose: () => void;
}

const LinkTooltip = ({ href, initialText = '', onEdit, onUnlink, onRemove, onClose }: LinkTooltipProps) => {
    const isNewLink = !href;
    const [mode, setMode] = useState<'view' | 'edit'>(isNewLink ? 'edit' : 'view');
    const [showCopied, setShowCopied] = useState(false);

    // Detect if this is an autolink (pure URL) vs a Markdown link [text](url)
    // Autolink: initialText is empty, matches href, or is just the URL itself
    const isAutolink = React.useMemo(() => {
        if (!initialText || initialText.trim() === '') return true;
        return initialText === href || initialText.trim() === href.trim();
    }, [initialText, href]);

    // For autolinks, start with empty text so user can optionally add a title
    // For Markdown links, use the existing display text
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

    // Sync edit mode to parent container to prevent hide during IME input
    useEffect(() => {
        const container = document.querySelector('.link-tooltip-container');
        if (container) {
            if (mode === 'edit') {
                container.setAttribute('data-editing', 'true');
            } else {
                container.removeAttribute('data-editing');
            }
        }
    }, [mode]);

    const handleSaveEdit = (shouldClose: boolean = false) => {
        // Only apply changes when Save is clicked or forced via click outside
        const isEmptyOrMatchesUrl = !editText.trim() || editText.trim() === editUrl.trim();
        const textToSave = isEmptyOrMatchesUrl ? editUrl : editText;

        // Remove data-editing BEFORE calling onEdit so hide() in plugin is not blocked
        const container = document.querySelector('.link-tooltip-container');
        container?.removeAttribute('data-editing');

        onEdit(textToSave, editUrl, shouldClose);
        if (!shouldClose) {
            setMode('view');
        }
    };

    // Handle click outside to save/close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const container = document.querySelector('.link-tooltip-container');
            // Check if click is inside the tooltip container
            if (container && container.contains(event.target as Node)) {
                return;
            }

            // Check if click is inside a radix dropdown (portal)
            const target = event.target as Element;
            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[role="menu"]')) {
                return;
            }

            // Click is outside
            if (mode === 'edit') {
                handleSaveEdit(true); // Save and close
            } else {
                onClose();
            }
        };

        // Use mousedown to capture before other handlers (like editor selection change)
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [mode, editText, editUrl, onClose]); // Dependencies including state for handleSaveEdit closure


    const displayUrl = React.useMemo(() => {
        try {
            const url = new URL(href);
            const cleanHost = url.hostname.replace(/^www\./, '');
            return cleanHost + (url.pathname.length > 1 && url.pathname !== '/' ? url.pathname : '');
        } catch {
            return href;
        }
    }, [href]);

    const handleCopy = () => {
        // Smart copy: preserve original format
        let copyText: string;
        if (isAutolink) {
            // Pure URL - just copy the URL
            copyText = href;
        } else {
            // Markdown link - copy as [text](url)
            copyText = `[${initialText}](${href})`;
        }
        navigator.clipboard.writeText(copyText);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const handleOpen = async () => {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(href);
        } catch (err) {
            console.warn('[LinkTooltip] Failed to open URL:', err);
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };



    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Don't interfere with IME composition (Chinese/Japanese/Korean input)
        if (e.nativeEvent.isComposing) {
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSaveEdit(true);
        } else {
            // For other keys like Space/Delete/Typing in inputs, 
            // ensure we don't accidentally trigger editor hotkeys
            e.stopPropagation();
        }
    };

    const dynamicWidth = React.useMemo(() => {
        // For autolinks, only URL matters; for Markdown links, consider both
        const maxLength = isAutolink ? editUrl.length : Math.max(editText.length, editUrl.length);
        // Base width 320px + approx 8px per char + extra padding
        return Math.min(Math.max(320, maxLength * 8 + 80), 520);
    }, [editText, editUrl, isAutolink]);

    // --- EDIT MODE ---
    if (mode === 'edit') {
        return (
            <div
                className="flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 gap-2 animate-in fade-in zoom-in-95 duration-200"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div
                    className="flex flex-col gap-2 transition-all duration-200 ease-out"
                    style={{ width: `${dynamicWidth}px` }}
                >
                    {/* Text input - always shown to allow users to add/edit display text */}
                    <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                        <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                            Text
                        </span>
                        <input
                            autoFocus={!isNewLink || !initialText}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                            placeholder="Display text (optional)"
                        />
                    </div>

                    <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                        <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                            Link
                        </span>
                        <input
                            autoFocus={isNewLink && !!initialText}
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-600 dark:text-gray-300 placeholder:text-gray-400"
                            placeholder="https://..."
                        />
                    </div>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handleSaveEdit(false)}
                                className="flex items-center justify-center size-8 text-[var(--neko-accent)] hover:opacity-80 rounded-full transition-all flex-shrink-0"
                            >
                                <Check className="size-5 stroke-[2.5]" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Save changes</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    }

    // --- VIEW MODE ---
    return (
        <div
            className="flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 gap-1 animate-in fade-in zoom-in-95 duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={handleOpen}
                            className="group flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors max-w-[200px]"
                        >
                            <div className="flex items-center justify-center size-5 rounded text-gray-400 group-hover:text-blue-500 transition-colors">
                                <ExternalLink className="size-3" />
                            </div>
                            <span className="truncate text-[13px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                {displayUrl}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{href}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <IconButton
                    onClick={handleCopy}
                    icon={showCopied ? <Check className="size-4 text-green-500 scale-110" /> : <Copy className="size-4" />}
                />

                <IconButton
                    onClick={() => setMode('edit')}
                    icon={<Edit2 className="size-4" />}
                />
            </div>

            <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                {/* Unlink button - only show for Markdown links (not autolinks) */}
                {!isAutolink && (
                    <IconButton
                        onClick={onUnlink}
                        icon={<Unlink className="size-4" />}
                    />
                )}

                <IconButton
                    onClick={onRemove}
                    icon={<Trash2 className="size-4" />}
                    className="hover:text-red-500"
                />
            </div>
        </div>
    );
};

export default LinkTooltip;
