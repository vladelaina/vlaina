// Shiki utility functions
import { createHighlighter, bundledLanguagesInfo, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

// Languages with icons - sorted by popularity
const LANGUAGES_WITH_ICONS: { id: BundledLanguage; name: string; aliases?: string[] }[] = [
  // Top 20 Most Popular
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'java', name: 'Java' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'cpp', name: 'C++', aliases: ['c++', 'cc'] },
  { id: 'c', name: 'C' },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
  { id: 'php', name: 'PHP' },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'swift', name: 'Swift' },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Bash', aliases: ['shell', 'sh'] },
  { id: 'powershell', name: 'PowerShell', aliases: ['ps1'] },
  { id: 'json', name: 'JSON' },
  { id: 'jsonc', name: 'JSON with Comments' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  
  // Popular Web & Frontend
  { id: 'tsx', name: 'TSX' },
  { id: 'jsx', name: 'JSX' },
  { id: 'vue', name: 'Vue' },
  { id: 'vue-html', name: 'Vue HTML' },
  { id: 'vue-vine', name: 'Vue Vine' },
  { id: 'svelte', name: 'Svelte' },
  { id: 'mdx', name: 'MDX' },
  { id: 'scss', name: 'SCSS' },
  { id: 'sass', name: 'Sass' },
  { id: 'less', name: 'Less' },
  { id: 'stylus', name: 'Stylus', aliases: ['styl'] },
  { id: 'postcss', name: 'PostCSS' },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
  
  // Popular Backend & Systems
  { id: 'scala', name: 'Scala' },
  { id: 'dart', name: 'Dart' },
  { id: 'elixir', name: 'Elixir' },
  { id: 'erlang', name: 'Erlang' },
  { id: 'haskell', name: 'Haskell' },
  { id: 'clojure', name: 'Clojure' },
  { id: 'lua', name: 'Lua' },
  { id: 'perl', name: 'Perl' },
  { id: 'r', name: 'R' },
  { id: 'julia', name: 'Julia' },
  { id: 'matlab', name: 'MATLAB' },
  
  // Functional & Academic
  { id: 'ocaml', name: 'OCaml' },
  { id: 'fsharp', name: 'F#', aliases: ['f#'] },
  { id: 'elm', name: 'Elm' },
  { id: 'purescript', name: 'PureScript' },
  
  // Markup & Documentation
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'xml', name: 'XML' },
  { id: 'toml', name: 'TOML' },
  { id: 'latex', name: 'LaTeX' },
  { id: 'tex', name: 'TeX' },
  
  // DevOps & Config
  { id: 'docker', name: 'Dockerfile', aliases: ['dockerfile'] },
  { id: 'terraform', name: 'Terraform', aliases: ['tf'] },
  { id: 'nginx', name: 'Nginx' },
  { id: 'apache', name: 'Apache' },
  { id: 'dotenv', name: 'dotEnv' },
  
  // Databases & Query
  { id: 'prisma', name: 'Prisma' },
  { id: 'proto', name: 'Protocol Buffer', aliases: ['protobuf'] },
  
  // Templates & Frameworks
  { id: 'jinja', name: 'Jinja' },
  { id: 'liquid', name: 'Liquid' },
  { id: 'handlebars', name: 'Handlebars', aliases: ['hbs'] },
  { id: 'pug', name: 'Pug', aliases: ['jade'] },
  { id: 'twig', name: 'Twig' },
  { id: 'haml', name: 'Haml' },
  { id: 'razor', name: 'Razor' },
  { id: 'astro', name: 'Astro' },
  
  // Scripting & Shell
  { id: 'shellscript', name: 'Shell Script' },
  { id: 'groovy', name: 'Groovy' },
  { id: 'coffee', name: 'CoffeeScript', aliases: ['coffeescript'] },
  
  // Game Development
  { id: 'gdscript', name: 'GDScript' },
  { id: 'solidity', name: 'Solidity' },
  { id: 'wasm', name: 'WebAssembly' },
  
  // Systems & Low-level
  { id: 'zig', name: 'Zig' },
  { id: 'nim', name: 'Nim' },
  { id: 'crystal', name: 'Crystal' },
  { id: 'fortran-fixed-form', name: 'Fortran (Fixed Form)', aliases: ['f', 'for', 'f77'] },
  { id: 'fortran-free-form', name: 'Fortran (Free Form)', aliases: ['f90', 'f95', 'f03', 'f08', 'f18'] },
  { id: 'objective-c', name: 'Objective-C', aliases: ['objc'] },
  { id: 'objective-cpp', name: 'Objective-C++' },
  
  // Niche but with icons
  { id: 'nix', name: 'Nix' },
  { id: 'viml', name: 'Vim Script', aliases: ['vim', 'vimscript'] },
  { id: 'cmake', name: 'CMake' },
  { id: 'make', name: 'Makefile', aliases: ['makefile'] },
  { id: 'diff', name: 'Diff' },
  { id: 'log', name: 'Log' },
  { id: 'ini', name: 'INI' },
  { id: 'json5', name: 'JSON5' },
  { id: 'git-commit', name: 'Git Commit' },
  { id: 'git-rebase', name: 'Git Rebase' },
  { id: 'hcl', name: 'HCL' },
];

// Get all languages without icons (will be appended at the end)
const getLanguagesWithoutIcons = () => {
  const withIconIds = new Set(LANGUAGES_WITH_ICONS.map(l => l.id));
  return bundledLanguagesInfo
    .filter(info => !withIconIds.has(info.id as BundledLanguage))
    .map(info => ({
      id: info.id as BundledLanguage,
      name: info.name,
      aliases: info.aliases as string[] | undefined
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical for languages without icons
};

// Combined list: languages with icons first (by popularity), then without icons (alphabetically)
export const SUPPORTED_LANGUAGES = [
  ...LANGUAGES_WITH_ICONS,
  ...getLanguagesWithoutIcons()
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
  if (!lang) {
    return null;
  }
  
  const normalized = lang.toLowerCase().trim();
  
  // Direct match
  const direct = SUPPORTED_LANGUAGES.find(l => l.id === normalized);
  if (direct) {
    return direct.id;
  }
  
  // Alias match
  const aliased = SUPPORTED_LANGUAGES.find(l => l.aliases?.includes(normalized));
  if (aliased) {
    return aliased.id;
  }
  
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