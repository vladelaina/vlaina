import React from 'react';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { useCodeBlockState } from './hooks/useCodeBlockState';
import { CodeBlockHeader } from './components/CodeBlockHeader';

interface CodeBlockViewProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ node, view, getPos }) => {
    const {
        language,
        displayName,
        copied,
        isLangMenuOpen,
        setIsLangMenuOpen,
        headerRef,
        updateLanguage,
        handleCopy,
        toggleCollapse,
        handleShare
    } = useCodeBlockState({ node, view, getPos });

    return (
        <CodeBlockHeader 
            headerRef={headerRef}
            language={language}
            displayName={displayName}
            nodeContent={node.textContent}
            copied={copied}
            isLangMenuOpen={isLangMenuOpen}
            setIsLangMenuOpen={setIsLangMenuOpen}
            onToggleCollapse={toggleCollapse}
            onLanguageChange={updateLanguage}
            onCopy={handleCopy}
            onShare={handleShare}
        />
    );
};
