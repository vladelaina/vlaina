import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionCollisionFixture {
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
  sampleCount = 24,
  minimumAccuracy = 1,
): LanguageDetectionCollisionFixture {
  return {
    language,
    arbitrary,
    sampleCount,
    minimumAccuracy,
  };
}

export const LANGUAGE_DETECTION_COLLISION_SEED = 20260401;

export const languageDetectionCollisionFixtures: readonly LanguageDetectionCollisionFixture[] = [
  fixture(
    'fsharp',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `let note = "let rec sum ${value} = if ${value} <= 0 then 0 else ${value}"`,
        'let numbers = [1..5] |> List.map (fun item -> item + 1)',
        'printfn "%A" numbers',
      ]),
    ),
  ),
  fixture(
    'ocaml',
    fc.record({
      fnName: lowerWord,
      value: lowerWord,
    }).map(({ fnName, value }) =>
      lines([
        'let note = "printfn \\"%A\\" numbers"',
        `let rec ${fnName} ${value} =`,
        `  if ${value} <= 0 then 0 else ${value} + ${fnName} (${value} - 1)`,
      ]),
    ),
  ),
  fixture(
    'matlab',
    fc.record({
      value: pascalName,
    }).map(({ value }) =>
      lines([
        `% values = [x^2 for x in 1:10]`,
        `${value} = [1 2 3; 4 5 6];`,
        `disp(size(${value}));`,
      ]),
    ),
  ),
  fixture(
    'julia',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        '# disp(size(values));',
        `function ${fnName}(value)`,
        '    println(value^2)',
        'end',
      ]),
    ),
  ),
  fixture(
    'zig',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'const php = "<?php echo $value;"',
        `pub fn ${fnName}() i32 { return 1; }`,
      ]),
    ),
  ),
  fixture(
    'php',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '<?php',
        `$${value} = "pub fn echo() i32 { return 1; }";`,
        `echo $${value};`,
      ]),
    ),
  ),
  fixture(
    'nim',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'let note = "def render(value): return value.strip()"',
        `proc ${fnName}(value: string): string =`,
        '  result = value.strip()',
      ]),
    ),
  ),
  fixture(
    'python',
    fc.record({
      fnName: snakeName,
    }).map(({ fnName }) =>
      lines([
        '"""proc render(value: string): string ="""',
        `def ${fnName}(value: str) -> str:`,
        '    return value.strip()',
      ]),
    ),
  ),
  fixture(
    'twig',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '{% extends "base.html.twig" %}',
        `{% set note = "assign ${value} = product.title | upcase" %}`,
        `{{ ${value}|merge(extra)|json_encode }}`,
      ]),
    ),
  ),
  fixture(
    'liquid',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `{% assign ${value} = product.title %}`,
        `{% comment %}{{ item|merge(extra)|json_encode }}{% endcomment %}`,
        `{{ ${value} | upcase | escape }}`,
      ]),
    ),
  ),
  fixture(
    'r',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `note <- "package App::Runner; sub run { my $${value} = shift; }"`,
        'library(dplyr)',
        `data <- data.frame(${value} = c(1, 2, 3))`,
      ]),
    ),
  ),
  fixture(
    'perl',
    fc.record({
      value: lowerWord,
    }).map(({ value }) =>
      lines([
        'use strict;',
        `my $${value} = "data <- data.frame(value = c(1, 2, 3))";`,
        `print $${value};`,
      ]),
    ),
  ),
  fixture(
    'haskell',
    fc.record({
      moduleName: pascalName,
    }).map(({ moduleName }) =>
      lines([
        '-- import SwiftUI',
        `module ${moduleName} where`,
        'main :: IO ()',
        'main = print [x ^ 2 | x <- [1..5]]',
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
        `let note = "main :: IO () -> print ${value}"`,
        `@State private var ${value} = ""`,
      ]),
    ),
  ),
];
