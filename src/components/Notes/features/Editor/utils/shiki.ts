import { createHighlighter, type BundledLanguage, type Highlighter } from 'shiki';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
type EditorLanguage = BundledLanguage | 'txt';

const CORE_LANGUAGES: { id: BundledLanguage; name: string; aliases?: string[] }[] = [
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'jsx', name: 'JSX' },
  { id: 'tsx', name: 'TSX' },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'java', name: 'Java' },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
  { id: 'php', name: 'PHP' },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'swift', name: 'Swift' },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'lua', name: 'Lua' },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Bash', aliases: ['shell', 'sh'] },
  { id: 'json', name: 'JSON' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'xml', name: 'XML' },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
];

export const SUPPORTED_LANGUAGES: { id: EditorLanguage; name: string; aliases?: string[] }[] = [
  { id: 'txt', name: 'TXT', aliases: ['text', 'plaintext'] },
  ...CORE_LANGUAGES,
];

const INITIAL_LANGUAGES: BundledLanguage[] = CORE_LANGUAGES.map((lang) => lang.id);

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: INITIAL_LANGUAGES,
  });

  highlighterInstance = await highlighterPromise;
  return highlighterInstance;
}

export function normalizeLanguage(lang: string | null): EditorLanguage | null {
  if (!lang) {
    return null;
  }

  const normalized = lang.toLowerCase().trim();

  const direct = SUPPORTED_LANGUAGES.find((language) => language.id === normalized);
  if (direct) {
    return direct.id;
  }

  const aliased = SUPPORTED_LANGUAGES.find((language) => language.aliases?.includes(normalized));
  if (aliased) {
    return aliased.id;
  }

  return null;
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
