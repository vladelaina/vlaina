// Shiki utility functions
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

// Supported languages
export const SUPPORTED_LANGUAGES: { id: BundledLanguage; name: string; aliases?: string[] }[] = [
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'jsx', name: 'JSX' },
  { id: 'tsx', name: 'TSX' },
  { id: 'vue', name: 'Vue' },
  { id: 'svelte', name: 'Svelte' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'scss', name: 'SCSS' },
  { id: 'less', name: 'Less' },
  { id: 'json', name: 'JSON' },
  { id: 'jsonc', name: 'JSONC' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'toml', name: 'TOML' },
  { id: 'xml', name: 'XML' },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
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
  { id: 'dart', name: 'Dart' },
  { id: 'lua', name: 'Lua' },
  { id: 'r', name: 'R' },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Bash', aliases: ['shell', 'sh'] },
  { id: 'powershell', name: 'PowerShell', aliases: ['ps1', 'ps'] },
  { id: 'batch', name: 'Batch', aliases: ['bat'] },
  { id: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
  { id: 'makefile', name: 'Makefile', aliases: ['make'] },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
  { id: 'perl', name: 'Perl', aliases: ['pl'] },
  { id: 'haskell', name: 'Haskell', aliases: ['hs'] },
  { id: 'scala', name: 'Scala' },
  { id: 'elixir', name: 'Elixir', aliases: ['ex'] },
  { id: 'erlang', name: 'Erlang', aliases: ['erl'] },
  { id: 'clojure', name: 'Clojure', aliases: ['clj'] },
  { id: 'lisp', name: 'Lisp' },
  { id: 'fortran', name: 'Fortran' },
  { id: 'julia', name: 'Julia', aliases: ['jl'] },
  { id: 'matlab', name: 'Matlab' },
  { id: 'objective-c', name: 'Objective-C', aliases: ['objc'] },
  { id: 'swift', name: 'Swift' },
  { id: 'groovy', name: 'Groovy' },
  { id: 'diff', name: 'Diff' },
  { id: 'ini', name: 'INI' },
  { id: 'latex', name: 'LaTeX', aliases: ['tex'] },
  { id: 'nginx', name: 'Nginx' },
  { id: 'vim', name: 'Vim Script', aliases: ['vimscript'] },
  { id: 'wasm', name: 'WebAssembly' },
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
