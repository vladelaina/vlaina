import React, { useState } from 'react';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { Check, Copy } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../utils/shiki';

interface CodeBlockViewProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ node, view, getPos }) => {
  const language = node.attrs.language || 'text';
  const [copied, setCopied] = useState(false);

  const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language);
  const displayName = langInfo ? langInfo.name : language;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const code = node.textContent;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only render the Header. The content area is handled by ProseMirror's contentDOM in the parent NodeView.
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--neko-bg-tertiary)]/50 border-b border-[var(--neko-border)] select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--neko-text-secondary)]">
            {displayName}
          </span>
        </div>
        
        <button 
          onClick={handleCopy}
          className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
    </div>
  );
};