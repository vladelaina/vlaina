import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';
import {
  LANGUAGE_DETECTION_ACCURACY_SEED,
  languageDetectionAccuracyFixtures,
} from './languageDetectionAccuracy.fixtures';
import {
  LANGUAGE_DETECTION_CHALLENGE_SEED,
  languageDetectionChallengeFixtures,
} from './languageDetectionChallenge.fixtures';

interface BatchFixture {
  language: string;
  sampleCount: number;
  arbitrary: fc.Arbitrary<string>;
  seed: number;
  family: 'accuracy' | 'challenge';
}

interface ConfusionEntry {
  expected: string;
  actual: string | null;
  count: number;
  sample: string;
}

const CONFUSION_ACCURACY_MULTIPLIER = 4;
const CONFUSION_CHALLENGE_MULTIPLIER = 4;

function normalizeLanguage(language: string | null) {
  return normalizeCodeBlockLanguage(language) ?? language;
}

function createBatchFixtures(): BatchFixture[] {
  return [
    ...languageDetectionAccuracyFixtures.map((fixture, index) => ({
      language: fixture.language,
      sampleCount: fixture.sampleCount * CONFUSION_ACCURACY_MULTIPLIER,
      arbitrary: fixture.arbitrary,
      seed: LANGUAGE_DETECTION_ACCURACY_SEED + index,
      family: 'accuracy' as const,
    })),
    ...languageDetectionChallengeFixtures.map((fixture, index) => ({
      language: fixture.language,
      sampleCount: fixture.sampleCount * CONFUSION_CHALLENGE_MULTIPLIER,
      arbitrary: fixture.arbitrary,
      seed: LANGUAGE_DETECTION_CHALLENGE_SEED + index,
      family: 'challenge' as const,
    })),
  ];
}

function collectConfusions(fixtures: readonly BatchFixture[]) {
  const confusionMap = new Map<string, ConfusionEntry>();
  let total = 0;
  let matched = 0;
  let nullCount = 0;

  for (const fixture of fixtures) {
    const samples = fc.sample(fixture.arbitrary, {
      numRuns: fixture.sampleCount,
      seed: fixture.seed,
    });
    const normalizedExpected = normalizeLanguage(fixture.language);

    for (const sample of samples) {
      total += 1;

      const actual = guessLanguage(sample);
      const normalizedActual = normalizeLanguage(actual);

      if (normalizedActual === normalizedExpected) {
        matched += 1;
        continue;
      }

      if (actual == null) {
        nullCount += 1;
      }

      const key = `${fixture.family}:${fixture.language}->${actual ?? 'null'}`;
      const existing = confusionMap.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }

      confusionMap.set(key, {
        expected: fixture.language,
        actual,
        count: 1,
        sample,
      });
    }
  }

  const confusions = [...confusionMap.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return `${left.expected}->${left.actual ?? 'null'}`.localeCompare(
      `${right.expected}->${right.actual ?? 'null'}`,
    );
  });

  return {
    total,
    matched,
    nullCount,
    confusions,
    accuracy: total === 0 ? 0 : matched / total,
  };
}

function createReport(result: ReturnType<typeof collectConfusions>) {
  const lines = [
    `language detection confusion accuracy=${(result.accuracy * 100).toFixed(1)}% (${result.matched}/${result.total})`,
    `null predictions=${result.nullCount}`,
  ];

  if (result.confusions.length === 0) {
    lines.push('confusions: none');
    return lines.join('\n');
  }

  lines.push(
    ...result.confusions.slice(0, 20).map((entry, index) => {
      const preview = entry.sample.replace(/\n/g, '\\n').slice(0, 140);
      return `${index + 1}) ${entry.expected} -> ${entry.actual ?? 'null'} x${entry.count} sample=${preview}`;
    }),
  );

  return lines.join('\n');
}

describe('guessLanguage confusion matrix', () => {
  const result = collectConfusions(createBatchFixtures());

  it('keeps a larger deterministic mixed corpus free from cross-language collisions', () => {
    expect(result.total).toBeGreaterThan(0);
    expect(result.accuracy).toBe(1);
    expect(result.nullCount).toBe(0);
    expect(result.confusions).toEqual([]);
  });

  it('prints the current confusion report', () => {
    console.info(`\n${createReport(result)}`);
  });
});
