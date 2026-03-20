import type { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { normalizeLanguage } from '../../utils/shiki';

type SupportedLanguageDescription = LanguageDescription & {
  alias: readonly string[];
};

export interface CodeBlockLanguageInfo {
  id: string;
  name: string;
  aliases: readonly string[];
}

export class CodeBlockLanguageLoader {
  private readonly descriptions: SupportedLanguageDescription[];
  private readonly map: Record<string, SupportedLanguageDescription>;

  constructor(descriptions: readonly LanguageDescription[]) {
    this.descriptions = descriptions
      .filter((description): description is SupportedLanguageDescription => Array.isArray(description.alias))
      .sort((left, right) => left.name.localeCompare(right.name));
    this.map = {};

    for (const description of this.descriptions) {
      this.map[description.name.toLowerCase()] = description;
      for (const alias of description.alias) {
        this.map[alias.toLowerCase()] = description;
      }
    }
  }

  getAll(): CodeBlockLanguageInfo[] {
    return this.descriptions.map((description) => ({
      id: description.alias[0] ?? description.name.toLowerCase(),
      name: description.name,
      aliases: description.alias,
    }));
  }

  resolveLanguageId(languageName: string | null | undefined) {
    const normalized = normalizeLanguage(languageName ?? '') ?? languageName?.toLowerCase().trim() ?? '';
    const description = this.map[normalized];
    if (!description) {
      return null;
    }

    return description.alias[0] ?? description.name.toLowerCase();
  }

  normalizeLanguageId(languageName: string | null | undefined) {
    const resolvedLanguageId = this.resolveLanguageId(languageName);
    if (resolvedLanguageId) {
      return resolvedLanguageId;
    }

    const normalized = languageName?.trim().toLowerCase() ?? '';
    return normalized || null;
  }

  load(languageName: string | null | undefined) {
    const normalizedLanguageId = this.normalizeLanguageId(languageName);
    if (!normalizedLanguageId) {
      return Promise.resolve(undefined);
    }

    const description = this.map[normalizedLanguageId];
    if (!description) {
      return Promise.resolve(undefined);
    }

    if (description.support) {
      return Promise.resolve(description.support);
    }

    return description.load();
  }
}

export const codeBlockLanguageLoader = new CodeBlockLanguageLoader(languages);
export const codeBlockLanguages = codeBlockLanguageLoader.getAll();
