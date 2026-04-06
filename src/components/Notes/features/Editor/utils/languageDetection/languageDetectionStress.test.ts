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
import {
  LANGUAGE_DETECTION_COLLISION_SEED,
  languageDetectionCollisionFixtures,
} from './languageDetectionCollision.fixtures';
import {
  LANGUAGE_DETECTION_MIXED_BIAS_SEED,
  languageDetectionMixedBiasFixtures,
} from './languageDetectionMixedBias.fixtures';
import {
  LANGUAGE_DETECTION_REJECTION_SEED,
  languageDetectionRejectionFixtures,
} from './languageDetectionRejection.fixtures';
import {
  LANGUAGE_DETECTION_ULTRA_SHORT_SEED,
  languageDetectionUltraShortFixtures,
} from './languageDetectionUltraShort.fixtures';

interface ExpectedFixture {
  label: string;
  sampleCount: number;
  arbitrary: fc.Arbitrary<string>;
  expected: string;
}

interface AllowedFixture {
  label: string;
  sampleCount: number;
  arbitrary: fc.Arbitrary<string>;
  allowed: readonly (string | null)[];
}

interface FixtureFailure {
  actual: string | null;
  sample: string;
}

interface FamilyResult {
  family: string;
  matched: number;
  total: number;
  failures: FixtureFailure[];
}

const STRESS_SEED_OFFSETS = [0, 101, 307, 701, 1103] as const;
const STRESS_SAMPLE_MULTIPLIER = 2;

function normalizeLanguage(language: string | null | undefined) {
  return normalizeCodeBlockLanguage(language) ?? language ?? null;
}

function runExpectedFamily(
  family: string,
  fixtures: readonly ExpectedFixture[],
  baseSeed: number,
): FamilyResult {
  const failures: FixtureFailure[] = [];
  let matched = 0;
  let total = 0;

  for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex += 1) {
    const fixture = fixtures[fixtureIndex];
    const normalizedExpected = normalizeLanguage(fixture.expected);

    for (let seedIndex = 0; seedIndex < STRESS_SEED_OFFSETS.length; seedIndex += 1) {
      const samples = fc.sample(fixture.arbitrary, {
        numRuns: fixture.sampleCount * STRESS_SAMPLE_MULTIPLIER,
        seed: baseSeed + fixtureIndex * 1000 + STRESS_SEED_OFFSETS[seedIndex],
      });

      for (const sample of samples) {
        total += 1;

        const actual = guessLanguage(sample);
        const normalizedActual = normalizeLanguage(actual);

        if (normalizedActual === normalizedExpected) {
          matched += 1;
          continue;
        }

        if (failures.length < 8) {
          failures.push({
            actual,
            sample: `${fixture.label} | ${sample}`,
          });
        }
      }
    }
  }

  return {
    family,
    matched,
    total,
    failures,
  };
}

function runAllowedFamily(
  family: string,
  fixtures: readonly AllowedFixture[],
  baseSeed: number,
): FamilyResult {
  const failures: FixtureFailure[] = [];
  let matched = 0;
  let total = 0;

  for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex += 1) {
    const fixture = fixtures[fixtureIndex];
    const normalizedAllowed = new Set(fixture.allowed.map((item) => normalizeLanguage(item)));

    for (let seedIndex = 0; seedIndex < STRESS_SEED_OFFSETS.length; seedIndex += 1) {
      const samples = fc.sample(fixture.arbitrary, {
        numRuns: fixture.sampleCount * STRESS_SAMPLE_MULTIPLIER,
        seed: baseSeed + fixtureIndex * 1000 + STRESS_SEED_OFFSETS[seedIndex],
      });

      for (const sample of samples) {
        total += 1;

        const actual = guessLanguage(sample);
        const normalizedActual = normalizeLanguage(actual);

        if (normalizedAllowed.has(normalizedActual)) {
          matched += 1;
          continue;
        }

        if (failures.length < 8) {
          failures.push({
            actual,
            sample: `${fixture.label} | ${sample}`,
          });
        }
      }
    }
  }

  return {
    family,
    matched,
    total,
    failures,
  };
}

function createReport(results: readonly FamilyResult[]) {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);

  return [
    `language detection stress seeds=${STRESS_SEED_OFFSETS.join(',')} multiplier=${STRESS_SAMPLE_MULTIPLIER}`,
    ...results.map((result) => {
      const failures = result.failures
        .slice(0, 2)
        .map((failure, index) => {
          const preview = failure.sample.replace(/\n/g, '\\n').slice(0, 180);
          return `${index + 1}) actual=${failure.actual ?? 'null'} sample=${preview}`;
        })
        .join(' | ');
      const accuracy = result.total === 0 ? 0 : (result.matched / result.total) * 100;
      const suffix = failures ? ` failures: ${failures}` : '';
      return `${result.family}: ${result.matched}/${result.total} (${accuracy.toFixed(1)}%)${suffix}`;
    }),
    `overall: ${matched}/${total} (${((matched / total) * 100).toFixed(1)}%)`,
  ].join('\n');
}

describe('guessLanguage stress sweep', () => {
  const results = [
    runExpectedFamily(
      'accuracy',
      languageDetectionAccuracyFixtures.map((fixture) => ({
        label: fixture.language,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        expected: fixture.language,
      })),
      LANGUAGE_DETECTION_ACCURACY_SEED,
    ),
    runExpectedFamily(
      'challenge',
      languageDetectionChallengeFixtures.map((fixture) => ({
        label: fixture.language,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        expected: fixture.language,
      })),
      LANGUAGE_DETECTION_CHALLENGE_SEED,
    ),
    runExpectedFamily(
      'collision',
      languageDetectionCollisionFixtures.map((fixture) => ({
        label: fixture.language,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        expected: fixture.language,
      })),
      LANGUAGE_DETECTION_COLLISION_SEED,
    ),
    runExpectedFamily(
      'ultra-short',
      languageDetectionUltraShortFixtures.map((fixture) => ({
        label: fixture.language,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        expected: fixture.language,
      })),
      LANGUAGE_DETECTION_ULTRA_SHORT_SEED,
    ),
    runAllowedFamily(
      'rejection',
      languageDetectionRejectionFixtures.map((fixture) => ({
        label: fixture.name,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        allowed: fixture.allowed,
      })),
      LANGUAGE_DETECTION_REJECTION_SEED,
    ),
    runExpectedFamily(
      'mixed-bias',
      languageDetectionMixedBiasFixtures.map((fixture) => ({
        label: fixture.language,
        sampleCount: fixture.sampleCount,
        arbitrary: fixture.arbitrary,
        expected: fixture.language,
      })),
      LANGUAGE_DETECTION_MIXED_BIAS_SEED,
    ),
  ] as const;

  const total = results.reduce((sum, result) => sum + result.total, 0);
  const matched = results.reduce((sum, result) => sum + result.matched, 0);
  const overallAccuracy = matched / total;

  it('stays stable across larger deterministic seed sweeps', () => {
    for (const result of results) {
      expect(result.total).toBeGreaterThan(0);
      expect(result.matched).toBe(result.total);
    }

    expect(overallAccuracy).toBe(1);
  });

  it('prints the current stress report', () => {
    console.info(`\n${createReport(results)}`);
  });
});
