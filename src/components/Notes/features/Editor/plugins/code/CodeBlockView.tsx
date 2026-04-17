import React, { useCallback } from 'react';
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
        updateLanguage,
        handleCopy,
        toggleCollapse
    } = useCodeBlockState({ node, view, getPos, getNode });
    const getNodeText = useCallback(() => getNode().textContent, [getNode]);

    return (
        <CodeBlockHeader 
            language={language}
            displayName={displayName}
            getNodeText={getNodeText}
            copied={copied}
            isLangMenuOpen={isLangMenuOpen}
            setIsLangMenuOpen={setIsLangMenuOpen}
            onToggleCollapse={toggleCollapse}
            onLanguageChange={updateLanguage}
            onCopy={handleCopy}
        />
    );
};
