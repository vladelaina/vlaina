import { createHighlighter, type Highlighter } from 'shiki';
import {
  initialHighlighterLanguages,
  normalizeSupportedCodeLanguage,
  supportedCodeLanguages,
  type CodeLanguageId,
} from './codeLanguages';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

export const SUPPORTED_LANGUAGES = supportedCodeLanguages;

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: initialHighlighterLanguages,
  });

  highlighterInstance = await highlighterPromise;
  return highlighterInstance;
}

export function normalizeLanguage(lang: string | null): CodeLanguageId | null {
  return normalizeSupportedCodeLanguage(lang);
}

export async function highlightCode(
  code: string,
  lang: string | null,
  theme: 'github-dark' | 'github-light' = 'github-dark',
): Promise<string> {
  const normalizedLang = normalizeLanguage(lang);
  if (!normalizedLang || normalizedLang === 'txt') {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(code, {
      lang: normalizedLang,
      theme,
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
