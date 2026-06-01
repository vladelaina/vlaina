import React from 'react';
import { CodeBlockCopyButton } from './CodeBlockCopyButton';
import './codeBlockChrome.css';

interface CodeBlockHeaderProps {
  copied?: boolean;
  getCopyText: () => string;
  languageControl: React.ReactNode;
  onCopy?: (content: string) => Promise<boolean | void> | boolean | void;
  onHeaderClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const CodeBlockHeader = React.memo(function CodeBlockHeader({
  copied = false,
  getCopyText,
  languageControl,
  onCopy,
  onHeaderClick,
}: CodeBlockHeaderProps) {
  return (
    <div
      onClick={onHeaderClick}
      className={onHeaderClick ? 'code-block-chrome-header cursor-pointer' : 'code-block-chrome-header'}
      data-chat-selection-excluded="true"
    >
      <div className="code-block-chrome-language" onClick={(event) => event.stopPropagation()}>
        {languageControl}
      </div>

      <div className="flex items-center gap-1">
        <CodeBlockCopyButton
          content={getCopyText()}
          copied={copied}
          onCopy={onCopy}
          stopPropagation
        />
      </div>
    </div>
  );
});
