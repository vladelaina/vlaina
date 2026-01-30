// Shiki utility functions
import { createHighlighter, bundledLanguagesInfo, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

// The 20 mainstream languages in preferred order
const MAINSTREAM_LANGS: { id: BundledLanguage; name: string; aliases?: string[] }[] = [
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'java', name: 'Java' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++', aliases: ['c++', 'cc'] },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'swift', name: 'Swift' },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Bash', aliases: ['shell', 'sh', 'bash'] },
  { id: 'json', name: 'JSON' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
];

// Combine mainstream with all other available languages from Shiki
// This provides comprehensive language support while keeping the top 20 prioritized
export const SUPPORTED_LANGUAGES = [
    ...MAINSTREAM_LANGS,
    ...bundledLanguagesInfo
        .filter(info => !MAINSTREAM_LANGS.some(m => m.id === info.id))
        .map(info => ({
            id: info.id as BundledLanguage,
            name: info.name,
            aliases: info.aliases as string[] | undefined
        }))
];

const INITIAL_LANGUAGES: BundledLanguage[] = [
  'javascript', 'typescript', 'python', 'rust', 'json', 'html', 'css', 'bash', 'markdown'
];

/**
 * Get or create the Shiki highlighter instance
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: INITIAL_LANGUAGES
  });

  highlighterInstance = await highlighterPromise;
  return highlighterInstance;
}

/**
 * Normalize language identifier
 */
export function normalizeLanguage(lang: string | null): BundledLanguage | null {
  if (!lang) return null;
  
  const normalized = lang.toLowerCase().trim();
  
  // Direct match
  const direct = SUPPORTED_LANGUAGES.find(l => l.id === normalized);
  if (direct) return direct.id;
  
  // Alias match
  const aliased = SUPPORTED_LANGUAGES.find(l => l.aliases?.includes(normalized));
  if (aliased) return aliased.id;
  
  return null;
}

/**
 * Highlight code with Shiki
 */
export async function highlightCode(
  code: string,
  lang: string | null,
  theme: 'github-dark' | 'github-light' = 'github-dark'
): Promise<string> {
  const highlighter = await getHighlighter();
  const normalizedLang = normalizeLanguage(lang);
  
  if (!normalizedLang) {
    // Return plain text with basic escaping
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  // Load language if not already loaded
  const loadedLangs = highlighter.getLoadedLanguages();
  if (!loadedLangs.includes(normalizedLang)) {
    try {
      await highlighter.loadLanguage(normalizedLang);
    } catch {
      return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    }
  }

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    theme
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}