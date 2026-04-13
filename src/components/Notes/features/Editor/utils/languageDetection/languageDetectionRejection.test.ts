import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';
import {
  LANGUAGE_DETECTION_REJECTION_SEED,
  languageDetectionRejectionFixtures,
  type LanguageDetectionRejectionFixture,
} from './languageDetectionRejection.fixtures';

interface RejectionFailure {
  actual: string | null;
  sample: string;
}

interface RejectionResult {
  fixture: LanguageDetectionRejectionFixture;
  matched: number;
  total: number;
  accuracy: number;
  failures: RejectionFailure[];
}

function normalizeLanguage(language: string | null) {
  return normalizeCodeBlockLanguage(language) ?? language;
}

function runFixture(fixture: LanguageDetectionRejectionFixture, index: number): RejectionResult {
  const samples = fc.sample(fixture.arbitrary, {
    numRuns: fixture.sampleCount,
    seed: LANGUAGE_DETECTION_REJECTION_SEED + index,
  });

  const failures: RejectionFailure[] = [];
  const allowed = new Set(fixture.allowed.map(normalizeLanguage));
  let matched = 0;

  for (const sample of samples) {
    const actual = guessLanguage(sample);
    const normalizedActual = normalizeLanguage(actual);

    if (allowed.has(normalizedActual)) {
      matched += 1;
      continue;
    }

    failures.push({
      actual,
      sample,
    });
  }

  return {
    fixture,
    matched,
    total: samples.length,
    accuracy: samples.length === 0 ? 0 : matched / samples.length,
    failures,
  };
}

function createReport(results: readonly RejectionResult[]) {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);

  return [
    `language detection rejection seed=${LANGUAGE_DETECTION_REJECTION_SEED}`,
    ...results.map((result) => {
      const failures = result.failures
        .slice(0, 2)
        .map((failure, index) => {
          const preview = failure.sample.replace(/\n/g, '\\n').slice(0, 160);
          return `${index + 1}) actual=${failure.actual ?? 'null'} sample=${preview}`;
        })
        .join(' | ');
      const suffix = failures ? ` failures: ${failures}` : '';
      const allowed = result.fixture.allowed.map((value) => value ?? 'null').join(', ');
      return `${result.fixture.name}: ${result.matched}/${result.total} (${(result.accuracy * 100).toFixed(1)}%) allowed=[${allowed}]${suffix}`;
    }),
    `overall: ${matched}/${total} (${((matched / total) * 100).toFixed(1)}%)`,
  ].join('\n');
}

describe('guessLanguage rejection behavior', () => {
  const results = languageDetectionRejectionFixtures.map(runFixture);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  const overallAccuracy = matched / total;

  it('does not confidently misclassify plain text, logs, or unsupported snippets', () => {
    for (const result of results) {
      expect(result.total).toBe(result.fixture.sampleCount);
      expect(result.accuracy).toBeGreaterThanOrEqual(1);
    }

    expect(overallAccuracy).toBe(1);
  });

  it('prints the current rejection report', () => {
    console.info(`\n${createReport(results)}`);
  });
});
