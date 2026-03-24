import React from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { LanguageSelector } from './LanguageSelector';

interface CodeBlockHeaderProps {
    language: string;
    displayName: string;
    getNodeText: () => string;
    copied: boolean;
    isLangMenuOpen: boolean;
    setIsLangMenuOpen: (open: boolean) => void;
    onToggleCollapse: (e: React.MouseEvent) => void;
    onLanguageChange: (lang: string) => void;
    onCopy: (e: React.MouseEvent) => void;
}

export const CodeBlockHeader = ({
    language,
    displayName,
    getNodeText,
    copied,
    isLangMenuOpen,
    setIsLangMenuOpen,
    onToggleCollapse,
    onLanguageChange,
    onCopy
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
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                        "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                        "hover:bg-black/5 dark:hover:bg-white/5",
                        copied && "text-green-500 hover:text-green-600"
                    )}
                >
                    {copied ? <Icon size="md" name="common.check" className="block" /> : <Icon name="common.copy" size="md" className="block" />}
                </button>
            </div>
        </div>
    );
};
