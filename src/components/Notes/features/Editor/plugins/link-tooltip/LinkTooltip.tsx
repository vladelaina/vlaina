import React, { useState, useEffect } from 'react';
import { Copy, Edit2, MoreHorizontal, Check, Trash2, Unlink, ExternalLink } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

export interface LinkTooltipProps {
    href: string;
    onClose: () => void;
}

const LinkTooltip = ({ href, onClose }: LinkTooltipProps) => {
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [showCopied, setShowCopied] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const [editUrl, setEditUrl] = useState(href);
    const [editText, setEditText] = useState('Link Text');

    useEffect(() => {
        setEditUrl(href);
    }, [href]);

    // Sync dropdown state to parent container for plugin detection
    useEffect(() => {
        const container = document.querySelector('.link-tooltip-container');
        if (container) {
            if (dropdownOpen) {
                container.setAttribute('data-dropdown-open', 'true');
            } else {
                container.removeAttribute('data-dropdown-open');
            }
        }
    }, [dropdownOpen]);

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
        navigator.clipboard.writeText(href);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const handleOpen = () => {
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    const handleSaveEdit = () => {
        // TODO: Implement actual save logic to update the link in the editor
        setMode('view');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            setMode('view');
        }
    };

    const dynamicWidth = React.useMemo(() => {
        const maxLength = Math.max(editText.length, editUrl.length);
        return Math.min(Math.max(320, maxLength * 9 + 100), 520);
    }, [editText, editUrl]);

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
                    <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                        <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                            Text
                        </span>
                        <input
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                            placeholder="Link text"
                        />
                    </div>

                    <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                        <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                            Link
                        </span>
                        <input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-gray-600 dark:text-gray-300 placeholder:text-gray-400"
                            placeholder="https://..."
                        />
                    </div>
                </div>

                <button
                    onClick={handleSaveEdit}
                    className="flex items-center justify-center size-8 text-[var(--neko-accent)] hover:opacity-80 rounded-full transition-all flex-shrink-0"
                    title="Save changes"
                >
                    <Check className="size-5 stroke-[2.5]" />
                </button>
            </div>
        );
    }

    // --- VIEW MODE ---
    return (
        <div
            className="flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 gap-1 animate-in fade-in zoom-in-95 duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={handleOpen}
                className="group flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors max-w-[200px]"
                title={href}
            >
                <div className="flex items-center justify-center size-5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-500">
                    <ExternalLink className="size-3" />
                </div>
                <span className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {displayUrl}
                </span>
            </button>

            <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <button
                    onClick={handleCopy}
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-all"
                    title="Copy link"
                >
                    {showCopied ? <Check className="size-4 text-green-500 scale-110" /> : <Copy className="size-4" />}
                </button>

                <button
                    onClick={() => setMode('edit')}
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-all"
                    title="Edit link"
                >
                    <Edit2 className="size-4" />
                </button>

                <DropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                        <button className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-all outline-none">
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-40 p-1">
                        <DropdownMenuItem onClick={() => { /* TODO: Unlink */ }} className="text-xs font-medium">
                            <Unlink className="mr-2 size-3.5" />
                            <span>Unlink</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem className="text-xs font-medium text-red-600 focus:text-red-700 dark:text-red-400" onClick={() => { /* TODO: Delete */ }}>
                            <Trash2 className="mr-2 size-3.5" />
                            <span>Remove</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

export default LinkTooltip;
