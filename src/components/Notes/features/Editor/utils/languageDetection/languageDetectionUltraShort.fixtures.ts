import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionUltraShortFixture {
  language: string;
  sampleCount: number;
  minimumAccuracy: number;
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

const pascalWord = fc.constantFrom(
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

const camelName = fc
  .tuple(lowerWord, fc.array(pascalWord, { minLength: 0, maxLength: 2 }))
  .map(([head, tail]) => [head, ...tail].join(''));

const snakeName = fc
  .tuple(lowerWord, fc.array(lowerWord, { minLength: 1, maxLength: 2 }))
  .map(([head, tail]) => [head, ...tail].join('_'));

const pascalName = fc
  .tuple(pascalWord, fc.array(pascalWord, { minLength: 0, maxLength: 1 }))
  .map(([head, tail]) => [head, ...tail].join(''));

function lines(parts: readonly string[]) {
  return parts.join('\n');
}

function fixture(
  language: string,
  arbitrary: Arbitrary<string>,
  sampleCount = 32,
  minimumAccuracy = 1,
): LanguageDetectionUltraShortFixture {
  return {
    language,
    arbitrary,
    sampleCount,
    minimumAccuracy,
  };
}

export const LANGUAGE_DETECTION_ULTRA_SHORT_SEED = 20260402;

export const languageDetectionUltraShortFixtures: readonly LanguageDetectionUltraShortFixture[] = [
  fixture(
    'bash',
    fc.record({
      folder: lowerWord,
    }).map(({ folder }) =>
      lines([
        `for file in ./${folder}/*.ts; do`,
        '  echo "$file"',
        'done',
      ]),
    ),
  ),
  fixture(
    'go',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `${value}, err := load()`,
        'if err != nil { return err }',
      ]),
    ),
  ),
  fixture(
    'graphql',
    fc.record({
      value: camelName,
    }).map(({ value }) => `{ user(id: $${value}) { id } }`),
  ),
  fixture(
    'haskell',
    fc.record({
      fnName: lowerWord,
    }).map(({ fnName }) =>
      lines([
        `${fnName} :: IO ()`,
        `${fnName} = print [x ^ 2 | x <- [1..5]]`,
      ]),
    ),
  ),
  fixture(
    'julia',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) => `${fnName}(value) = value^2 + 1`),
  ),
  fixture(
    'liquid',
    fc.record({
      value: camelName,
    }).map(({ value }) => `{{ ${value} | upcase | escape }}`),
  ),
  fixture(
    'markdown',
    fc.record({
      title: pascalName,
    }).map(({ title }) =>
      lines([
        `## ${title}`,
        '[Docs](/docs)',
      ]),
    ),
  ),
  fixture(
    'matlab',
    fc.record({
      matrixName: pascalName,
    }).map(({ matrixName }) =>
      lines([
        `${matrixName} = [1 2 3; 4 5 6];`,
        `disp(size(${matrixName}));`,
      ]),
    ),
  ),
  fixture(
    'nim',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) => `proc ${fnName}(value: string): string = value.strip()`),
  ),
  fixture(
    'ocaml',
    fc.record({
      fnName: lowerWord,
      value: lowerWord,
    }).map(({ fnName, value }) => `let rec ${fnName} ${value} = if ${value} <= 0 then 0 else ${value} + ${fnName} (${value} - 1)`),
  ),
  fixture(
    'perl',
    fc.record({
      value: lowerWord,
    }).map(({ value }) =>
      lines([
        'use strict;',
        `print $${value};`,
      ]),
    ),
  ),
  fixture(
    'php',
    fc.record({
      value: camelName,
    }).map(({ value }) => `<?php echo $${value};`),
  ),
  fixture(
    'powershell',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        'param([string]$Path)',
        `$${value} = Get-Item -Path $Path`,
      ]),
    ),
  ),
  fixture(
    'python',
    fc.record({
      fnName: snakeName,
    }).map(({ fnName }) =>
      lines([
        `def ${fnName}(value):`,
        '    return value.strip()',
      ]),
    ),
  ),
  fixture(
    'r',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        'library(dplyr)',
        `data <- data.frame(${value} = c(1, 2, 3))`,
      ]),
    ),
  ),
  fixture(
    'swift',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        'import SwiftUI',
        `@State private var ${value} = ""`,
      ]),
    ),
  ),
  fixture(
    'toml',
    fc.record({
      value: lowerWord,
    }).map(({ value }) =>
      lines([
        '[package]',
        `name = "${value}"`,
      ]),
    ),
  ),
  fixture(
    'twig',
    fc.record({
      value: camelName,
    }).map(({ value }) => `{{ ${value}|merge(extra)|json_encode }}`),
  ),
  fixture(
    'typescript',
    fc.record({
      typeName: pascalName,
      value: camelName,
    }).map(({ typeName, value }) => `type ${typeName} = { ${value}: string }`),
  ),
  fixture(
    'yaml',
    fc.record({
      service: lowerWord,
    }).map(({ service }) =>
      lines([
        'services:',
        `  ${service}:`,
        '    image: node:20',
      ]),
    ),
  ),
  fixture(
    'zig',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) => `pub fn ${fnName}() i32 { return 1; }`),
  ),
];
