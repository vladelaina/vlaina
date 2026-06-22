import React, { useRef } from 'react';
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
  const suppressNextClickRef = useRef(false);

  const stopEditorEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onHeaderClick) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    stopEditorEvent(event);
    if (!onHeaderClick || event.button !== 0) return;
    suppressNextClickRef.current = true;
    onHeaderClick(event);
  };

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    stopEditorEvent(event);
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
    if (!onHeaderClick || event.button !== 0) return;
    suppressNextClickRef.current = true;
    onHeaderClick(event);
  };

  const handleHeaderClick = (event: React.MouseEvent<HTMLDivElement>) => {
    stopEditorEvent(event);
    if (!onHeaderClick) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onHeaderClick(event);
  };

  return (
    <div
      onPointerDown={handleHeaderPointerDown}
      onMouseDown={handleHeaderMouseDown}
      onClick={handleHeaderClick}
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
