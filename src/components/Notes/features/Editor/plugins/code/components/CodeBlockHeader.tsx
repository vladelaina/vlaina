import React from 'react';
import { CodeBlockHeader as SharedCodeBlockHeader } from '@/components/common/code-block';
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
    onCopy: () => Promise<boolean>;
}

export const CodeBlockHeader = React.memo(function CodeBlockHeader({
    language,
    displayName,
    getNodeText,
    copied,
    isLangMenuOpen,
    setIsLangMenuOpen,
    onToggleCollapse,
    onLanguageChange,
    onCopy
}: CodeBlockHeaderProps) {
    return (
        <SharedCodeBlockHeader
            copied={copied}
            getCopyText={getNodeText}
            onCopy={onCopy}
            onHeaderClick={onToggleCollapse}
            languageControl={(
                <LanguageSelector 
                    language={language}
                    displayName={displayName}
                    getNodeText={getNodeText}
                    onLanguageChange={onLanguageChange}
                    isOpen={isLangMenuOpen}
                    onOpenChange={setIsLangMenuOpen}
                />
            )}
        />
    );
});
