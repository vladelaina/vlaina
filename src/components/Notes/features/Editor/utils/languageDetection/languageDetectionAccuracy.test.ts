import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';
import {
  LANGUAGE_DETECTION_ACCURACY_SEED,
  languageDetectionAccuracyFixtures,
  type LanguageDetectionFixture,
} from './languageDetectionAccuracy.fixtures';

interface FixtureFailure {
  actual: string | null;
  sample: string;
}

interface FixtureResult {
  fixture: LanguageDetectionFixture;
  matched: number;
  total: number;
  accuracy: number;
  failures: FixtureFailure[];
}

function runFixture(fixture: LanguageDetectionFixture, index: number): FixtureResult {
  const samples = fc.sample(fixture.arbitrary, {
    numRuns: fixture.sampleCount,
    seed: LANGUAGE_DETECTION_ACCURACY_SEED + index,
  });

  const failures: FixtureFailure[] = [];
  let matched = 0;

  for (const sample of samples) {
    const actual = guessLanguage(sample);
    const normalizedActual = normalizeCodeBlockLanguage(actual) ?? actual;
    const normalizedExpected = normalizeCodeBlockLanguage(fixture.language) ?? fixture.language;
    if (normalizedActual === normalizedExpected) {
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

function createReport(results: readonly FixtureResult[]) {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  const lines = [
    `language detection seed=${LANGUAGE_DETECTION_ACCURACY_SEED}`,
    ...results.map((result) => {
      const failures = result.failures
        .slice(0, 2)
        .map((failure, index) => {
          const preview = failure.sample.replace(/\n/g, '\\n').slice(0, 140);
          return `${index + 1}) actual=${failure.actual ?? 'null'} sample=${preview}`;
        })
        .join(' | ');

      const suffix = failures ? ` failures: ${failures}` : '';
      return `${result.fixture.language}: ${result.matched}/${result.total} (${(result.accuracy * 100).toFixed(1)}%)${suffix}`;
    }),
    `overall: ${matched}/${total} (${((matched / total) * 100).toFixed(1)}%)`,
  ];

  return lines.join('\n');
}

describe('guessLanguage accuracy', () => {
  const results = languageDetectionAccuracyFixtures.map(runFixture);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  const overallAccuracy = matched / total;

  it('measures a deterministic strong-signal corpus across supported languages', () => {
    for (const result of results) {
      expect(result.total).toBe(result.fixture.sampleCount);
      expect(result.accuracy).toBeGreaterThanOrEqual(result.fixture.minimumAccuracy);
    }

    expect(overallAccuracy).toBeGreaterThanOrEqual(0.98);
  });

  it('prints the current per-language accuracy report', () => {
    console.info(`\n${createReport(results)}`);
  });
});
