import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { languageDetectionAccuracyFixtures } from './languageDetectionAccuracy.fixtures';
import { languageDetectionChallengeFixtures } from './languageDetectionChallenge.fixtures';

const currentDir = dirname(fileURLToPath(import.meta.url));
const detectorsDir = join(currentDir, 'detectors');

const detectorToLanguage = new Map<string, string>([
  ['csharp', 'csharp'],
  ['markup', 'html'],
  ['objectivec', 'objectivec'],
  ['sass', 'scss'],
  ['shell', 'bash'],
  ['vim', 'viml'],
]);

function normalizeDetector(detector: string) {
  return detectorToLanguage.get(detector) ?? detector;
}

function getCoveredLanguages() {
  const covered = new Set<string>();

  for (const fixture of languageDetectionAccuracyFixtures) {
    covered.add(fixture.language);
  }

  for (const fixture of languageDetectionChallengeFixtures) {
    covered.add(fixture.language);
  }

  covered.add('markdown');
  covered.add('xml');

  return covered;
}

describe('guessLanguage coverage inventory', () => {
  it('prints which detector languages are already covered by bulk tests', () => {
    const detectors = readdirSync(detectorsDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    const coveredLanguages = getCoveredLanguages();
    const covered: string[] = [];
    const uncovered: string[] = [];

    for (const detector of detectors) {
      const language = normalizeDetector(detector);
      if (coveredLanguages.has(language)) {
        covered.push(language);
      } else {
        uncovered.push(language);
      }
    }

    console.info(
      [
        `covered detectors: ${covered.length}`,
        covered.join(', '),
        `uncovered detectors: ${uncovered.length}`,
        uncovered.join(', '),
      ].join('\n'),
    );

    expect(uncovered.length).toBeLessThan(detectors.length);
  });
});
