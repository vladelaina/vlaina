import type { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { normalizeSupportedCodeLanguage, supportedCodeLanguages } from '../../utils/codeLanguages';

type SupportedLanguageDescription = LanguageDescription & {
  alias: readonly string[];
};

export interface CodeBlockLanguageInfo {
  id: string;
  name: string;
  aliases: readonly string[];
}

function getDescriptionId(description: SupportedLanguageDescription) {
  return description.alias[0] ?? description.name.toLowerCase();
}

export class CodeBlockLanguageLoader {
  private readonly descriptions: SupportedLanguageDescription[];
  private readonly descriptionMap: Record<string, SupportedLanguageDescription>;
  private readonly languageInfos: CodeBlockLanguageInfo[];

  constructor(descriptions: readonly LanguageDescription[]) {
    this.descriptions = descriptions
      .filter((description): description is SupportedLanguageDescription => Array.isArray(description.alias))
      .sort((left, right) => left.name.localeCompare(right.name));
    this.descriptionMap = {};

    for (const description of this.descriptions) {
      this.descriptionMap[description.name.toLowerCase()] = description;
      for (const alias of description.alias) {
        this.descriptionMap[alias.toLowerCase()] = description;
      }
    }

    const catalogOnlyLanguages = supportedCodeLanguages
      .filter((language) => !this.descriptionMap[language.id])
      .map((language) => ({
        id: language.id,
        name: language.name,
        aliases: language.aliases ?? [],
      }));

    this.languageInfos = [
      ...this.descriptions.map((description) => ({
        id: getDescriptionId(description),
        name: description.name,
        aliases: description.alias,
      })),
      ...catalogOnlyLanguages,
    ].sort((left, right) => left.name.localeCompare(right.name));
  }

  getAll(): CodeBlockLanguageInfo[] {
    return this.languageInfos;
  }

  resolveLanguageId(languageName: string | null | undefined) {
    const normalizedCatalogLanguage = normalizeSupportedCodeLanguage(languageName);
    if (normalizedCatalogLanguage) {
      const description = this.descriptionMap[normalizedCatalogLanguage];
      if (description) {
        return getDescriptionId(description);
      }

      return normalizedCatalogLanguage;
    }

    const normalized = languageName?.toLowerCase().trim() ?? '';
    if (!normalized) {
      return null;
    }

    const description = this.descriptionMap[normalized];
    if (!description) {
      return null;
    }

    return getDescriptionId(description);
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

    const description = this.descriptionMap[normalizedLanguageId];
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
