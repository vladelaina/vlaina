import React from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LanguageSelector } from './LanguageSelector';

interface CodeBlockHeaderProps {
    language: string;
    displayName: string;
    getNodeText: () => string;
    copied: boolean;
    isLangMenuOpen: boolean;
    setIsLangMenuOpen: (open: boolean) => void;
    isActionMenuOpen: boolean;
    setIsActionMenuOpen: (open: boolean) => void;
    onToggleCollapse: (e: React.MouseEvent) => void;
    onLanguageChange: (lang: string) => void;
    onCopy: (e: React.MouseEvent) => void;
    onShare: (e: React.MouseEvent) => void;
}

export const CodeBlockHeader = ({
    language,
    displayName,
    getNodeText,
    copied,
    isLangMenuOpen,
    setIsLangMenuOpen,
    isActionMenuOpen,
    setIsActionMenuOpen,
    onToggleCollapse,
    onLanguageChange,
    onCopy,
    onShare
}: CodeBlockHeaderProps) => {
    return (
        <div 
            onClick={onToggleCollapse}
            className="flex items-center justify-between px-4 py-2 bg-transparent select-none transition-all h-[40px] cursor-pointer"
        >
            <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                <LanguageSelector 
                    language={language}
                    displayName={displayName}
                    getNodeText={getNodeText}
                    onLanguageChange={onLanguageChange}
                    isOpen={isLangMenuOpen}
                    onOpenChange={setIsLangMenuOpen}
                />
            </div>
            
            <div className="flex items-center gap-1">
                <button 
                    onClick={onCopy}
                    className={cn("flex items-center justify-center size-8 rounded-full p-0 leading-none", iconButtonStyles, copied && "text-green-500 hover:text-green-600")}
                >
                    {copied ? <Icon size="md" name="common.check" className=" block" /> : <Icon name="common.copy" className=" block" />}
                </button>
                <Popover open={isActionMenuOpen} onOpenChange={setIsActionMenuOpen}>
                    <PopoverTrigger asChild>
                        <button 
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={cn("flex items-center justify-center size-8 rounded-full p-0 leading-none", iconButtonStyles)}
                        >
                            <Icon size="md" name="common.more" className=" block" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="w-32 p-1 overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-xl rounded-xl"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                         <button
                            type="button"
                            onClick={onShare}
                            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-[var(--neko-text-secondary)] transition-colors hover:bg-[var(--neko-hover)] hover:text-[var(--neko-text-primary)]"
                         >
                            <Icon size="md" name="common.share" className="mr-2 " />
                            <span>Share</span>
                         </button>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};
