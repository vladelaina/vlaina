import { createHighlighter, bundledThemes, bundledLanguages } from 'shiki/bundle/full';

export let highlighter: any = null;

export async function initHighlighter() {
  if (highlighter) return highlighter;
  
  try {
    highlighter = await createHighlighter({
      langs: [
        bundledLanguages['javascript'],
        bundledLanguages['typescript'],
        bundledLanguages['python'],
        bundledLanguages['html'],
        bundledLanguages['css'],
        bundledLanguages['json'],
        bundledLanguages['markdown'],
        bundledLanguages['bash'],
        bundledLanguages['c'],
        bundledLanguages['cpp'],
        bundledLanguages['csharp'],
        bundledLanguages['java'],
        bundledLanguages['go'],
        bundledLanguages['rust'],
        bundledLanguages['sql'],
      ],
    });

    // Load themes explicitly
    await highlighter.loadTheme('one-dark');
    await highlighter.loadTheme('one-light');
  } catch (e) {
    console.warn("Failed to initialize Shiki highlighter:", e);
    // Return a fallback highlighter to prevent app crashes and stalling
    highlighter = {
      codeToHtml: (code: string, options: any) => {
        // Basic HTML escaping for safety
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        return `<pre class="shiki"><code>${escaped}</code></pre>`;
      },
      loadTheme: async () => {}, // No-op
      loadLanguage: async () => {}, // No-op
    };
  }
  
  return highlighter;
}