import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';

export interface HandcraftedLanguageCase {
  name: string;
  sample: string;
}

export const entry = (name: string, sample: string): HandcraftedLanguageCase => ({ name, sample });

function normalizeLanguage(language: string | null | undefined) {
  return normalizeCodeBlockLanguage(language) ?? language ?? null;
}

interface HandcraftedSuiteOptions {
  language: string;
  label?: string;
  cases: readonly HandcraftedLanguageCase[];
}

export function defineHandcraftedLanguageSuite({ language, label = language, cases }: HandcraftedSuiteOptions) {
  describe(`guessLanguage handcrafted ${label} corpus`, () => {
    it(`keeps 100 assistant-authored ${label} snippets classified correctly`, () => {
      const failures: string[] = [];
      const expected = normalizeLanguage(language);

      for (const item of cases) {
        const actual = guessLanguage(item.sample);
        if (normalizeLanguage(actual) !== expected) {
          failures.push(
            `${item.name}: actual=${actual ?? 'null'} sample=${item.sample.replace(/\n/g, '\\n')}`,
          );
        }
      }

      expect(cases).toHaveLength(100);
      expect(failures).toEqual([]);
    });

    it(`prints the current handcrafted ${label} report`, () => {
      const expected = normalizeLanguage(language);
      const matched = cases.filter((item) => normalizeLanguage(guessLanguage(item.sample)) === expected).length;

      console.info(
        `language detection handcrafted ${label}: ${matched}/${cases.length} (${((matched / cases.length) * 100).toFixed(1)}%)`,
      );
    });
  });
}
