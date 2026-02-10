import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '../../../utils/shiki';
import { getLanguageLogo } from '../../../utils/languageLogos';
import { guessLanguage } from '../../../utils/languageGuesser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LanguageSelectorProps {
    language: string;
    displayName: string;
    nodeContent: string;
    onLanguageChange: (lang: string) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const LanguageSelector = ({
    language,
    displayName,
    nodeContent,
    onLanguageChange,
    isOpen,
    onOpenChange
}: LanguageSelectorProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const filteredLanguages = useMemo(() => {
        setActiveIndex(0);
        if (!searchTerm) return SUPPORTED_LANGUAGES;
        const term = searchTerm.toLowerCase();
        return SUPPORTED_LANGUAGES.filter(l => 
            l.name.toLowerCase().includes(term) || 
            l.id.toLowerCase().includes(term) ||
            l.aliases?.some(a => a.toLowerCase().includes(term))
        );
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
        const guessed = guessLanguage(nodeContent);
        onLanguageChange(guessed || 'txt');
        onOpenChange(false);
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 group/lang cursor-pointer transition-colors select-none">
                    <div className="size-[18px] flex items-center justify-center flex-shrink-0 overflow-hidden rounded-none">
                        {getLanguageLogo(language) ? (
                            <img 
                                src={getLanguageLogo(language)?.url} 
                                className={cn("w-full h-full object-contain block rounded-none", getLanguageLogo(language)?.className)} 
                                alt={displayName}
                                style={{ borderRadius: '0' }}
                            />
                        ) : (
                            <Icon size="md" name="editor.code" className=" text-zinc-400 group-hover/lang:text-zinc-900 dark:group-hover/lang:text-zinc-100 transition-colors" />
                        )}
                    </div>
                    <span className="text-sm font-medium text-zinc-500 group-hover/lang:text-zinc-900 dark:group-hover/lang:text-zinc-100 transition-colors">
                        {displayName}
                    </span>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] p-0 overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800 shadow-xl rounded-xl">
                {/* Search Bar & Auto-Detect Group */}
                <div className="p-2 bg-gray-50/50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
                    <div className="relative flex items-center">
                        <Icon size="md" name="common.search" className="absolute left-2.5 top-1/2 -translate-y-1/2  text-gray-400" />
                        <input
                            autoFocus
                            className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg pl-8 pr-10 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                            className="absolute right-1.5 p-1 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                            <Icon size="md" name="ai.sparkle" />
                        </button>
                    </div>
                </div>

                {/* Languages List */}
                <div ref={scrollRef} className="max-h-[240px] overflow-y-auto p-1 neko-scrollbar">
                    {filteredLanguages.length > 0 ? (
                        filteredLanguages.map((lang, index) => {
                            const logo = getLanguageLogo(lang.id);
                            return (
                                <DropdownMenuItem 
                                    key={lang.id} 
                                    onSelect={() => onLanguageChange(lang.id)}
                                    className={cn(
                                        "text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2",
                                        index === activeIndex ? "bg-gray-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : "text-gray-600 dark:text-zinc-400",
                                        language === lang.id && index !== activeIndex && "text-blue-600 dark:text-blue-400 font-bold"
                                    )}
                                >
                                    {logo ? (
                                        <img src={logo.url} className={cn("size-4 object-contain flex-shrink-0", logo.className)} alt={lang.name} />
                                    ) : (
                                        <div className="size-4 flex items-center justify-center flex-shrink-0">
                                            <Icon name="editor.code" className="size-3.5 opacity-40" />
                                        </div>
                                    )}
                                    <span>{lang.name}</span>
                                </DropdownMenuItem>
                            );
                        })
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                            No languages found
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
