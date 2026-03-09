import { isValidElement, memo, useMemo } from 'react';
import 'highlight.js/styles/github-dark.css';
import CopyButton from '@/components/Chat/common/CopyButton';
import { chatHighlighter } from '../utils/chatHighlighter';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  isStreaming?: boolean;
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

export const CodeBlock = memo(({ className, children, isStreaming = false }: CodeBlockProps) => {
  const { language, codeText } = extractCodePayload(className, children);

  const highlightedHTML = useMemo(() => {
    if (isStreaming) {
      return null;
    }

    try {
      if (language && chatHighlighter.getLanguage(language)) {
        return chatHighlighter.highlight(codeText, { language }).value;
      }
      return chatHighlighter.highlightAuto(codeText).value;
    } catch (e) {
      return escapeHtml(codeText);
    }
  }, [codeText, isStreaming, language]);

  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden my-6 group">
      <div className="flex select-none px-4 py-2 items-center justify-between">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400 font-mono">
            {language || 'text'}
        </span>
        <CopyButton
          content={codeText}
          showLabels={false}
          className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
        />
      </div>
      <div className="overflow-x-auto p-4 pt-0">
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
    </div>
  );
});
