import { useMemo, useEffect, useRef } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; 
// Import Milkdown styles for consistency
import '../Notes/features/Editor/styles/core.css'; // Added core.css for selection etc.
import '../Notes/features/Editor/styles/markdown.css';
import '../Notes/features/Editor/styles/typography.css';
import '../Notes/features/Editor/styles/code-block.css';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    return parseMarkdown(content);
  }, [content]);

  useEffect(() => {
    if (containerRef.current) {
      // Highlight code blocks
      const blocks = containerRef.current.querySelectorAll('pre code');
      blocks.forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [htmlContent]);

  return (
    <div 
        ref={containerRef}
        className="milkdown prose dark:prose-invert max-w-none text-[15px] leading-7"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

function parseMarkdown(text: string): string {
    const codeBlockMap = new Map<string, string>();
    const inlineCodeMap = new Map<string, string>();
    
    let processed = text;

    // 1. Extract Fenced Code Blocks
    processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const id = `__CODE_BLOCK_${Math.random().toString(36).substr(2, 9)}__`;
        codeBlockMap.set(id, `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`);
        return id;
    });

    // 2. Extract Inline Code
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
        const id = `__INLINE_CODE_${Math.random().toString(36).substr(2, 9)}__`;
        inlineCodeMap.set(id, `<code>${escapeHtml(code)}</code>`);
        return id;
    });

    // 3. Process Standard Markdown
    processed = processed
        // Escape HTML first to prevent XSS (basic)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        
        // Bold & Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        // Blockquote
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        
        // Lists (Simple)
        .replace(/^\s*-\s(.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/<\/ul>\n<ul>/g, '') // Merge adjacent lists
        
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        
        // Line breaks (soft)
        .replace(/\n/g, '<br />');

    // 4. Restore Code
    // Restore Inline Code first
    inlineCodeMap.forEach((html, id) => {
        processed = processed.replace(id, html);
    });
    
    // Restore Blocks
    codeBlockMap.forEach((html, id) => {
        processed = processed.replace(id, html);
    });

    return processed;
}

function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
}