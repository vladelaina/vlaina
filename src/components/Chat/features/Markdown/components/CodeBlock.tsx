import { isValidElement, memo, useMemo } from 'react';
import 'highlight.js/styles/github-dark.css';
import CopyButton from '@/components/Chat/common/CopyButton';
import { writeTextToClipboard } from '@/lib/clipboard';
import { chatHighlighter } from '../utils/chatHighlighter';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  blockId?: string;
  copied?: boolean;
  onCopy?: (blockId: string) => void;
}

const LANGUAGE_CLASS_PATTERN = /language-([\w+-]+)/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseLanguageFromClassName(className: string): string {
  const match = LANGUAGE_CLASS_PATTERN.exec(className);
  return match ? match[1] : '';
}

function extractCodePayload(
  className: string | undefined,
  children: React.ReactNode,
): { language: string; codeText: string } {
  if (isValidElement(children)) {
    const props = children.props as {
      className?: string;
      children?: React.ReactNode;
    };
    const nestedClassName = props.className || className || '';
    const nestedLanguage = parseLanguageFromClassName(nestedClassName);
    const nestedCodeText = String(props.children ?? '').replace(/\n$/, '');
    return { language: nestedLanguage, codeText: nestedCodeText };
  }

  const language = parseLanguageFromClassName(className || '');
  const codeText = String(children).replace(/\n$/, '');
  return { language, codeText };
}

export const CodeBlock = memo(({ className, children, blockId, copied = false, onCopy }: CodeBlockProps) => {
  const { language, codeText } = extractCodePayload(className, children);

  const highlightedHTML = useMemo(() => {
    try {
      if (language && chatHighlighter.getLanguage(language)) {
        return chatHighlighter.highlight(codeText, { language }).value;
      }
      return chatHighlighter.highlightAuto(codeText).value;
    } catch (e) {
      return escapeHtml(codeText);
    }
  }, [codeText, language]);

  const handleCopy = async (content: string) => {
    const didCopy = await writeTextToClipboard(content);
    if (!didCopy) return false;

    if (blockId && onCopy) {
      onCopy(blockId);
    }
    return true;
  };

  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden my-6 group">
      <div className="flex select-none px-4 py-2 items-center justify-between">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400 font-mono">
            {language || 'text'}
        </span>
      </div>
      <div className="overflow-x-auto p-4 pt-0 pb-12">
        {highlightedHTML ? (
          <code
            className={`block whitespace-pre font-mono text-sm leading-relaxed hljs ${language} !bg-transparent !p-0`}
            dangerouslySetInnerHTML={{ __html: highlightedHTML }}
          />
        ) : (
          <pre className="m-0 p-0 bg-transparent">
            <code className={`font-mono text-sm leading-relaxed ${language}`}>
              {codeText}
            </code>
          </pre>
        )}
      </div>
      <div className="absolute bottom-2 right-2 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton
          content={codeText}
          copied={copied}
          onCopy={handleCopy}
          showLabels={false}
          className="rounded-lg bg-white/85 px-2 py-1.5 text-neutral-500 shadow-sm ring-1 ring-black/5 backdrop-blur hover:text-neutral-900 dark:bg-zinc-900/85 dark:text-neutral-400 dark:ring-white/10 dark:hover:text-neutral-200"
        />
      </div>
    </div>
  );
});
