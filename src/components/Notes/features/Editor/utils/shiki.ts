// Shiki utility functions
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

// Supported languages
export const SUPPORTED_LANGUAGES: { id: BundledLanguage; name: string; aliases?: string[] }[] = [
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'java', name: 'Java' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++', aliases: ['c++'] },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'json', name: 'JSON' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Bash', aliases: ['shell', 'sh'] },
  { id: 'jsx', name: 'JSX' },
  { id: 'tsx', name: 'TSX' },
  { id: 'vue', name: 'Vue' },
  { id: 'svelte', name: 'Svelte' },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'swift', name: 'Swift' },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'scala', name: 'Scala' },
  { id: 'r', name: 'R' },
  { id: 'lua', name: 'Lua' },
  { id: 'perl', name: 'Perl' },
  { id: 'haskell', name: 'Haskell', aliases: ['hs'] },
  { id: 'elixir', name: 'Elixir' },
  { id: 'clojure', name: 'Clojure', aliases: ['clj'] },
  { id: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
  { id: 'toml', name: 'TOML' },
  { id: 'xml', name: 'XML' },
  { id: 'latex', name: 'LaTeX', aliases: ['tex'] }
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
