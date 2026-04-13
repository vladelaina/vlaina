import type { BundledLanguage } from 'shiki';

export type CodeLanguageId = BundledLanguage | 'txt';

export interface CodeLanguageDefinition {
  id: CodeLanguageId;
  name: string;
  aliases?: readonly string[];
}

interface BundledCodeLanguageDefinition extends CodeLanguageDefinition {
  id: BundledLanguage;
}

const bundledCodeLanguages: BundledCodeLanguageDefinition[] = [
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
  { id: 'viml', name: 'Vim Script', aliases: ['vim', 'vimscript'] },
];

export const supportedCodeLanguages: CodeLanguageDefinition[] = [
  { id: 'txt', name: 'TXT', aliases: ['text', 'plaintext'] },
  ...bundledCodeLanguages,
];

export const initialHighlighterLanguages: BundledLanguage[] = bundledCodeLanguages.map(
  (language) => language.id,
);

const supportedCodeLanguageMap = new Map<string, CodeLanguageId>(
  supportedCodeLanguages.flatMap((language) => [
    [language.id.toLowerCase(), language.id] as const,
    ...(language.aliases ?? []).map((alias) => [alias.toLowerCase(), language.id] as const),
  ]),
);

export function normalizeSupportedCodeLanguage(languageName: string | null | undefined): CodeLanguageId | null {
  const normalized = languageName?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return supportedCodeLanguageMap.get(normalized) ?? null;
}
