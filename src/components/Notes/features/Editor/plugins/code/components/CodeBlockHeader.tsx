import React from 'react';
import { MdCheck, MdContentCopy, MdMoreHoriz, MdShare } from 'react-icons/md';
import { cn, iconButtonStyles } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSelector } from './LanguageSelector';

interface CodeBlockHeaderProps {
    headerRef: React.RefObject<HTMLDivElement | null>;
    language: string;
    displayName: string;
    nodeContent: string;
    copied: boolean;
    isLangMenuOpen: boolean;
    setIsLangMenuOpen: (open: boolean) => void;
    onToggleCollapse: (e: React.MouseEvent) => void;
    onLanguageChange: (lang: string) => void;
    onCopy: (e: React.MouseEvent) => void;
    onShare: (e: React.MouseEvent) => void;
}

export const CodeBlockHeader = ({
    headerRef,
    language,
    displayName,
    nodeContent,
    copied,
    isLangMenuOpen,
    setIsLangMenuOpen,
    onToggleCollapse,
    onLanguageChange,
    onCopy,
    onShare
}: CodeBlockHeaderProps) => {
    return (
        <div 
            ref={headerRef} 
            onClick={onToggleCollapse}
            className="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#1e1e1e] select-none rounded-t-xl transition-all h-[40px] cursor-pointer"
        >
            <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                <LanguageSelector 
                    language={language}
                    displayName={displayName}
                    nodeContent={nodeContent}
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
                    {copied ? <MdCheck className="size-[18px] block" /> : <MdContentCopy className="size-[18px] block" />}
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button 
                            onClick={(e) => e.stopPropagation()}
                            className={cn("flex items-center justify-center size-8 rounded-full p-0 leading-none", iconButtonStyles)}
                        >
                            <MdMoreHoriz className="size-[18px] block" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                         <DropdownMenuItem onClick={onShare} className="cursor-pointer text-xs">
                            <MdShare className="mr-2 size-[18px]" />
                            <span>Share</span>
                         </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};
