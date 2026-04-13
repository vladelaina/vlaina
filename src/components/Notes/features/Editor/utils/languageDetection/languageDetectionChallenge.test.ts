import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';
import {
  LANGUAGE_DETECTION_CHALLENGE_SEED,
  languageDetectionChallengeFixtures,
  type LanguageDetectionChallengeFixture,
} from './languageDetectionChallenge.fixtures';

interface ChallengeFailure {
  actual: string | null;
  sample: string;
}

interface ChallengeResult {
  fixture: LanguageDetectionChallengeFixture;
  matched: number;
  total: number;
  accuracy: number;
  failures: ChallengeFailure[];
}

function runFixture(fixture: LanguageDetectionChallengeFixture, index: number): ChallengeResult {
  const samples = fc.sample(fixture.arbitrary, {
    numRuns: fixture.sampleCount,
    seed: LANGUAGE_DETECTION_CHALLENGE_SEED + index,
  });

  const failures: ChallengeFailure[] = [];
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

function createReport(results: readonly ChallengeResult[]) {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  return [
    `language detection challenge seed=${LANGUAGE_DETECTION_CHALLENGE_SEED}`,
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
  ].join('\n');
}

describe('guessLanguage challenge accuracy', () => {
  const results = languageDetectionChallengeFixtures.map(runFixture);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  const overallAccuracy = matched / total;

  it('handles short and collision-prone snippets', () => {
    for (const result of results) {
      expect(result.total).toBe(result.fixture.sampleCount);
      expect(result.accuracy).toBeGreaterThanOrEqual(result.fixture.minimumAccuracy);
    }

    expect(overallAccuracy).toBeGreaterThanOrEqual(0.98);
  });

  it('prints the current challenge report', () => {
    console.info(`\n${createReport(results)}`);
  });
});
