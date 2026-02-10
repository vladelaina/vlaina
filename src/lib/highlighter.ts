import { createHighlighter } from 'shiki/bundle/web';

export let highlighter: any = null;

export async function initHighlighter() {
  if (highlighter) return highlighter;
  
  try {
    highlighter = await createHighlighter({
      themes: ['one-light', 'one-dark'],
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
    highlighter = null;
  }
  
  return highlighter;
}