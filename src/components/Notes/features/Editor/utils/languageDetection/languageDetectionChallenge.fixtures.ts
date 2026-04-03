import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionChallengeFixture {
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

const lowerQuoted = lowerWord.map((value) => `"${value}"`);
const routeWord = fc.constantFrom('users', 'notes', 'tasks', 'reports', 'sessions');
const portNumber = fc.integer({ min: 3000, max: 9999 });

function lines(parts: readonly string[]) {
  return parts.join('\n');
}

function fixture(
  language: string,
  arbitrary: Arbitrary<string>,
  sampleCount = 24,
  minimumAccuracy = 1,
): LanguageDetectionChallengeFixture {
  return {
    language,
    arbitrary,
    sampleCount,
    minimumAccuracy,
  };
}

export const LANGUAGE_DETECTION_CHALLENGE_SEED = 20260331;

export const languageDetectionChallengeFixtures: readonly LanguageDetectionChallengeFixture[] = [
  fixture(
    'javascript',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        `const ${fnName} = async () => {`,
        `  return await fetch('/api/${fnName}');`,
        '};',
      ]),
    ),
  ),
  fixture(
    'typescript',
    fc.record({
      typeName: pascalName,
      fieldName: camelName,
    }).map(({ typeName, fieldName }) =>
      lines([
        `interface ${typeName} {`,
        `  ${fieldName}: string;`,
        '}',
      ]),
    ),
  ),
  fixture(
    'python',
    fc.record({
      moduleName: snakeName,
      fnName: snakeName,
    }).map(({ moduleName, fnName }) =>
      lines([
        `from ${moduleName} import value`,
        `def ${fnName}(item):`,
        '    return item.strip()',
      ]),
    ),
  ),
  fixture(
    'ruby',
    fc.record({
      scopeName: snakeName,
    }).map(({ scopeName }) => `scope :${scopeName}, -> { order(created_at: :desc) }`),
  ),
  fixture(
    'bash',
    fc.record({
      folderName: lowerWord,
    }).map(({ folderName }) =>
      lines([
        'set -euo pipefail',
        `for file in ./${folderName}/*.ts; do`,
        '  echo "$file"',
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
        'if err != nil {',
        '    return err',
        '}',
      ]),
    ),
  ),
  fixture(
    'rust',
    fc.record({
      value: camelName,
    }).map(({ value }) => `let mut ${value}: Option<String> = None;`),
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
    'kotlin',
    fc.record({
      className: pascalName,
      fieldName: camelName,
    }).map(({ className, fieldName }) => `data class ${className}(val ${fieldName}: String)`),
  ),
  fixture(
    'lua',
    fc.record({
      value: camelName,
    }).map(({ value }) => `local ${value} = table.concat(items, ",")`),
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
    'makefile',
    fc.record({
      target: lowerWord,
    }).map(({ target }) =>
      lines([
        '.PHONY: build',
        `${target}:`,
        '\tpnpm build',
      ]),
    ),
  ),
  fixture(
    'dotenv',
    fc.record({
      port: portNumber,
    }).map(({ port }) =>
      lines([
        `APP_URL=https://app.example.com:${port}`,
        'DB_HOST=localhost',
      ]),
    ),
  ),
  fixture(
    'yaml',
    fc.record({
      serviceName: lowerWord,
    }).map(({ serviceName }) =>
      lines([
        'services:',
        `  ${serviceName}:`,
        '    image: node:20',
      ]),
    ),
  ),
  fixture(
    'toml',
    fc.record({
      name: lowerWord,
    }).map(({ name }) =>
      lines([
        '[package]',
        `name = "${name}"`,
        'version = "1.0.0"',
      ]),
    ),
  ),
  fixture(
    'terraform',
    fc.record({
      resourceName: snakeName,
    }).map(({ resourceName }) => `resource "aws_s3_bucket" "${resourceName}" {}`),
  ),
  fixture(
    'prisma',
    fc.record({
      modelName: pascalName,
    }).map(({ modelName }) =>
      lines([
        `model ${modelName} {`,
        '  id Int @id @default(autoincrement())',
        '}',
      ]),
    ),
  ),
  fixture(
    'markdown',
    fc.record({
      title: pascalName,
    }).map(({ title }) =>
      lines([
        `## ${title}`,
        '',
        '[Docs](/docs)',
      ]),
    ),
  ),
  fixture(
    'vue',
    fc.record({
      route: routeWord,
    }).map(({ route }) => `<template><button @click="open('/${route}')">{{ label }}</button></template>`),
  ),
  fixture(
    'svelte',
    fc.record({
      value: camelName,
    }).map(({ value }) => `$: ${value} = count * price`),
  ),
  fixture(
    'astro',
    fc.record({
      title: camelName,
    }).map(({ title }) =>
      lines([
        '---',
        `const ${title} = Astro.props.title;`,
        '---',
        `<h1>{${title}}</h1>`,
      ]),
    ),
  ),
  fixture(
    'mdx',
    fc.record({
      componentName: pascalName,
    }).map(({ componentName }) =>
      lines([
        `import { ${componentName} } from './components';`,
        '',
        `# ${componentName}`,
        '',
        `<${componentName} />`,
      ]),
    ),
  ),
  fixture(
    'handlebars',
    fc.record({
      value: camelName,
    }).map(({ value }) => `{{#if ${value}}}{{${value}}}{{/if}}`),
  ),
  fixture(
    'liquid',
    fc.record({
      value: camelName,
    }).map(({ value }) => `{{ ${value} | upcase | escape }}`),
  ),
  fixture(
    'jinja',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '{% extends "base.html" %}',
        `{{ ${value}|safe }}`,
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
    'html',
    fc.record({
      title: pascalName,
    }).map(({ title }) => `<section><h1>${title}</h1><p>body</p></section>`),
  ),
  fixture(
    'graphql',
    fc.record({
      queryName: pascalName,
      value: camelName,
    }).map(({ queryName, value }) =>
      lines([
        `query ${queryName}($${value}: ID!) {`,
        `  user(id: $${value}) { id }`,
        '}',
      ]),
    ),
  ),
  fixture(
    'fsharp',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `let ${value} : int = 42`,
        'let numbers = [1..5] |> List.filter (fun item -> item > 2)',
        'printfn "%A" numbers',
      ]),
    ),
  ),
  fixture(
    'haskell',
    fc.record({
      fnName: lowerWord,
    }).map(({ fnName }) =>
      lines([
        `${fnName} :: [Int] -> IO ()`,
        `${fnName} items = print [x ^ 2 | x <- items]`,
      ]),
    ),
  ),
  fixture(
    'julia',
    fc.record({
      value: lowerWord,
    }).map(({ value }) => `values = [${value}^2 for ${value} in 1:10]`),
  ),
  fixture(
    'matlab',
    fc.record({
      value: pascalName,
    }).map(({ value }) =>
      lines([
        `${value} = [1 2 3; 4 5 6];`,
        `disp(size(${value}));`,
      ]),
    ),
  ),
  fixture(
    'nim',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'from strutils import strip',
        `proc ${fnName}(value: string): string =`,
        '  result = value.strip()',
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
        `let rec ${fnName} ${value} =`,
        `  if ${value} <= 0 then 0 else ${value} + ${fnName} (${value} - 1)`,
      ]),
    ),
  ),
  fixture(
    'r',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `data <- data.frame(${value} = c(1, 2, 3))`,
        'summary(data)',
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
