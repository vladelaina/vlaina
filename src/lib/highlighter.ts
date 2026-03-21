import { createHighlighter } from 'shiki/bundle/full';

export let highlighter: any = null;

export async function initHighlighter() {
  if (highlighter) return highlighter;
  
  try {
    highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'html',
        'css',
        'json',
        'markdown',
        'bash',
        'c',
        'cpp',
        'csharp',
        'java',
        'go',
        'rust',
        'sql',
      ],
    });
  } catch (e) {
    console.warn("Failed to initialize Shiki highlighter:", e);
    highlighter = {
      codeToHtml: (code: string, _options: any) => {
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        return `<pre class="shiki"><code>${escaped}</code></pre>`;
      },
      loadTheme: async () => {},
      loadLanguage: async () => {},
    };
  }
  
  return highlighter;
}
