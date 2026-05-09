import { isValidElement, memo, useMemo } from 'react';
import { CodeBlockHeader } from '@/components/common/code-block';
import { writeTextToClipboard } from '@/lib/clipboard';
import { selectCodeBlockLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
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
  const showLineNumbers = useUnifiedStore(selectCodeBlockLineNumbersEnabled);
  const lineNumbers = useMemo(() => {
    const lineCount = codeText.length === 0 ? 1 : codeText.split('\n').length;
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [codeText]);

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
    <div className="vlaina-code-block relative my-4 overflow-hidden rounded-2xl group">
      <CodeBlockHeader
        copied={copied}
        getCopyText={() => codeText}
        languageControl={(
          <span className="vlaina-code-block-language-label">
            {language || 'text'}
          </span>
        )}
        onCopy={handleCopy}
      />
      <div className="vlaina-code-block-body overflow-x-auto p-4 pt-0">
        {showLineNumbers && (
          <pre className="vlaina-code-block-line-numbers" aria-hidden="true">
            {lineNumbers.join('\n')}
          </pre>
        )}
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
