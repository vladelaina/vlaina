import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';
import { languageDetectionRealWorldCorpus } from './languageDetectionRealWorldCorpus.fixtures';

function normalizeLanguage(language: string | null | undefined) {
  return normalizeCodeBlockLanguage(language) ?? language ?? null;
}

describe('guessLanguage real-world corpus', () => {
  it('keeps a curated user-style corpus classified correctly', () => {
    const failures: string[] = [];

    for (const entry of languageDetectionRealWorldCorpus) {
      const actual = guessLanguage(entry.sample);
      const normalizedActual = normalizeLanguage(actual);
      const normalizedExpected = normalizeLanguage(entry.expected);

      if (normalizedActual !== normalizedExpected) {
        failures.push(
          `${entry.name}: expected=${entry.expected ?? 'null'} actual=${actual ?? 'null'} sample=${entry.sample.replace(/\n/g, '\\n')}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('prints the current curated corpus report', () => {
    const matched = languageDetectionRealWorldCorpus.filter((entry) => {
      const actual = guessLanguage(entry.sample);
      return normalizeLanguage(actual) === normalizeLanguage(entry.expected);
    }).length;

    console.info(
      [
        `language detection real-world corpus: ${matched}/${languageDetectionRealWorldCorpus.length} (${((matched / languageDetectionRealWorldCorpus.length) * 100).toFixed(1)}%)`,
      ].join('\n'),
    );
  });
});
