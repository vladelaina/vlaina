import React from 'react';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { useCodeBlockState } from './hooks/useCodeBlockState';
import { CodeBlockHeader } from './components/CodeBlockHeader';

interface CodeBlockViewProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    getNode: () => Node;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ node, view, getPos, getNode }) => {
    const {
        language,
        displayName,
        copied,
        isLangMenuOpen,
        setIsLangMenuOpen,
        isActionMenuOpen,
        setIsActionMenuOpen,
        updateLanguage,
        handleCopy,
        toggleCollapse,
        handleShare
    } = useCodeBlockState({ node, view, getPos, getNode });

    return (
        <CodeBlockHeader 
            language={language}
            displayName={displayName}
            getNodeText={() => getNode().textContent}
            copied={copied}
            isLangMenuOpen={isLangMenuOpen}
            setIsLangMenuOpen={setIsLangMenuOpen}
            isActionMenuOpen={isActionMenuOpen}
            setIsActionMenuOpen={setIsActionMenuOpen}
            onToggleCollapse={toggleCollapse}
            onLanguageChange={updateLanguage}
            onCopy={handleCopy}
            onShare={handleShare}
        />
    );
};
