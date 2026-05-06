import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { guessLanguage } from '../../../utils/languageGuesser';
import { codeBlockLanguages } from '../codeBlockLanguageLoader';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

interface LanguageSelectorProps {
    language: string;
    displayName: string;
    getNodeText: () => string;
    onLanguageChange: (lang: string) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const LanguageSelector = React.memo(function LanguageSelector({
    language,
    displayName,
    getNodeText,
    onLanguageChange,
    isOpen,
    onOpenChange
}: LanguageSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const filteredLanguages = useMemo(() => {
        if (!searchTerm) return codeBlockLanguages;
        const term = searchTerm.toLowerCase();
        return codeBlockLanguages.filter(l =>
            l.name.toLowerCase().includes(term) ||
            l.id.toLowerCase().includes(term) ||
            l.aliases?.some(a => a.toLowerCase().includes(term))
        );
    }, [searchTerm]);

    useEffect(() => {
        setActiveIndex(0);
    }, [searchTerm]);

    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            const activeItem = scrollRef.current.children[activeIndex] as HTMLElement;
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [activeIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex(prev => Math.min(prev + 1, filteredLanguages.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const selected = filteredLanguages[activeIndex];
            if (selected) {
                onLanguageChange(selected.id);
                onOpenChange(false);
            }
        } else {
            e.stopPropagation();
        }
    };

    const handleAutoDetect = () => {
        const guessed = guessLanguage(getNodeText());
        onLanguageChange(guessed || 'txt');
        onOpenChange(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverAnchor asChild>
                <button
                    type="button"
                    className="flex items-center group/lang cursor-pointer transition-colors select-none"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenChange(!isOpen);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <span className="vlaina-code-block-language-label">
                        {displayName}
                    </span>
                </button>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[220px] overflow-hidden flex flex-col border border-[var(--notes-sidebar-menu-border)] bg-[var(--notes-sidebar-menu-bg)] p-0 shadow-[var(--notes-sidebar-menu-shadow)] rounded-xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="px-2 pt-2 pb-1">
                    <div className="relative flex h-[40px] items-center gap-2 rounded-md border border-transparent bg-[#f8f8f8] pl-3 pr-1 shadow-none">
                        <Icon size={18} name="common.search" className="text-[var(--vlaina-color-text-soft)]" />
                        <input
                            autoFocus
                            spellCheck={false}
                            className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--vlaina-color-text-soft)] outline-none placeholder:text-[var(--vlaina-color-text-soft)]"
                            placeholder="Search language..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAutoDetect();
                            }}
                            title="Auto Detect Language"
                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--vlaina-color-text-soft)] transition-colors hover:bg-[var(--notes-sidebar-row-hover)] hover:text-[var(--notes-sidebar-text)]"
                        >
                            <Icon size="md" name="common.sparkle" />
                        </button>
                    </div>
                </div>

                <div ref={scrollRef} className="max-h-[240px] overflow-y-auto p-1 vlaina-scrollbar">
                    {filteredLanguages.length > 0 ? (
                        filteredLanguages.map((lang, index) => {
                            return (
                                <button
                                    type="button"
                                    key={lang.id} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onLanguageChange(lang.id);
                                        onOpenChange(false);
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors",
                                        language === lang.id
                                            ? "bg-[var(--notes-sidebar-row-active)] text-[var(--sidebar-row-selected-text)] font-[550]"
                                            : index === activeIndex
                                                ? "bg-[var(--notes-sidebar-row-hover)] text-[var(--notes-sidebar-text)]"
                                                : "text-[var(--notes-sidebar-text-muted)] hover:bg-[var(--notes-sidebar-row-hover)] hover:text-[var(--notes-sidebar-text)]"
                                    )}
                                >
                                    <span>{lang.name}</span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                            No languages found
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
});
