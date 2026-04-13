import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionRejectionFixture {
  name: string;
  sampleCount: number;
  allowed: readonly (string | null)[];
  arbitrary: Arbitrary<string>;
}

const lowerWord = fc.constantFrom(
  'alpha',
  'beta',
  'gamma',
  'delta',
  'echo',
  'pixel',
  'nova',
  'orbit',
  'river',
  'signal',
  'vector',
  'zen',
);

const capitalWord = fc.constantFrom(
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Echo',
  'Pixel',
  'Nova',
  'Orbit',
  'River',
  'Signal',
  'Vector',
  'Zen',
);

const isoDate = fc
  .tuple(
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
  )
  .map(
    ([month, day, hour, minute, second]) =>
      `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  );

function lines(parts: readonly string[]) {
  return parts.join('\n');
}

function fixture(
  name: string,
  arbitrary: Arbitrary<string>,
  allowed: readonly (string | null)[] = [null],
  sampleCount = 32,
): LanguageDetectionRejectionFixture {
  return {
    name,
    arbitrary,
    allowed,
    sampleCount,
  };
}

export const LANGUAGE_DETECTION_REJECTION_SEED = 20260403;

export const languageDetectionRejectionFixtures: readonly LanguageDetectionRejectionFixture[] = [
  fixture(
    'plain prose',
    fc.tuple(capitalWord, lowerWord, lowerWord, lowerWord).map(([a, b, c, d]) => `${a} ${b} ${c} ${d}.`),
  ),
  fixture(
    'meeting note sentence',
    fc.tuple(capitalWord, lowerWord, lowerWord).map(([a, b, c]) => `${a} update: ${b} ${c} tomorrow.`),
  ),
  fixture(
    'structured log line',
    fc.tuple(isoDate, lowerWord, lowerWord).map(([date, service, event]) => `${date} INFO ${service} ${event} completed in 42ms`),
  ),
  fixture(
    'multi-line logs',
    fc.tuple(isoDate, isoDate, lowerWord).map(([start, end, service]) =>
      lines([
        `${start} INFO ${service} worker started`,
        `${end} WARN ${service} retry scheduled`,
      ]),
    ),
  ),
  fixture(
    'stack trace',
    fc.tuple(lowerWord, capitalWord).map(([fnName, fileName]) =>
      lines([
        `Error: ${fnName} failed`,
        `    at ${fnName} (${fileName}.tsx:42:13)`,
      ]),
    ),
  ),
  fixture(
    'plain csv row',
    fc.tuple(lowerWord, lowerWord, lowerWord).map(([a, b, c]) => `${a},${b},${c}`),
  ),
  fixture(
    'unsupported ini style',
    fc.tuple(lowerWord, lowerWord).map(([section, key]) =>
      lines([
        `[${section}]`,
        `${key}: enabled`,
      ]),
    ),
  ),
  fixture(
    'pascal-like snippet',
    fc.tuple(lowerWord, lowerWord).map(([programName, value]) =>
      lines([
        `program ${programName};`,
        `writeln('${value}');`,
      ]),
    ),
  ),
];
