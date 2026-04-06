import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionPairwiseFixture {
  name: string;
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
  name: string,
  language: string,
  arbitrary: Arbitrary<string>,
  sampleCount = 24,
  minimumAccuracy = 1,
): LanguageDetectionPairwiseFixture {
  return {
    name,
    language,
    arbitrary,
    sampleCount,
    minimumAccuracy,
  };
}

export const LANGUAGE_DETECTION_PAIRWISE_SEED = 20260405;

export const languageDetectionPairwiseFixtures: readonly LanguageDetectionPairwiseFixture[] = [
  fixture(
    'fsharp <- ocaml',
    'fsharp',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `let note = "let rec sum ${value} = if ${value} <= 0 then 0 else ${value}"`,
        'let numbers = [1..5] |> List.filter (fun item -> item > 2)',
        'printfn "%A" numbers',
      ]),
    ),
  ),
  fixture(
    'ocaml <- fsharp',
    'ocaml',
    fc.record({
      fnName: lowerWord,
      value: lowerWord,
    }).map(({ fnName, value }) =>
      lines([
        'let note = "printfn \\"%A\\" numbers"',
        `let rec ${fnName} ${value} = if ${value} <= 0 then 0 else ${value} + ${fnName} (${value} - 1)`,
      ]),
    ),
  ),
  fixture(
    'julia <- matlab',
    'julia',
    fc.record({
      value: lowerWord,
    }).map(({ value }) =>
      lines([
        '# disp(size(values));',
        `values = [${value}^2 for ${value} in 1:10]`,
      ]),
    ),
  ),
  fixture(
    'matlab <- julia',
    'matlab',
    fc.record({
      matrixName: pascalName,
    }).map(({ matrixName }) =>
      lines([
        '% values = [x^2 for x in 1:10]',
        `${matrixName} = [1 2 3; 4 5 6];`,
        `disp(size(${matrixName}));`,
      ]),
    ),
  ),
  fixture(
    'nim <- python',
    'nim',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'let note = "def render(value): return value.strip()"',
        `proc ${fnName}(value: string): string = value.strip()`,
      ]),
    ),
  ),
  fixture(
    'python <- nim',
    'python',
    fc.record({
      fnName: snakeName,
    }).map(({ fnName }) =>
      lines([
        '"""proc render(value: string): string ="""',
        `def ${fnName}(value):`,
        '    return value.strip()',
      ]),
    ),
  ),
  fixture(
    'php <- zig',
    'php',
    fc.record({
      value: camelName,
    }).map(({ value }) => `<?php $${value} = "pub fn echo() i32 { return 1; }"; echo $${value};`),
  ),
  fixture(
    'zig <- php',
    'zig',
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'const php = "<?php echo $value;";',
        `pub fn ${fnName}() i32 { return 1; }`,
      ]),
    ),
  ),
  fixture(
    'liquid <- twig',
    'liquid',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `{% assign ${value} = product.title %}`,
        '{% comment %}{{ item|merge(extra)|json_encode }}{% endcomment %}',
        `{{ ${value} | upcase | escape }}`,
      ]),
    ),
  ),
  fixture(
    'twig <- liquid',
    'twig',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `{% set ${value} = items|merge(extra) %}`,
        `{% set note = "assign ${value} = product.title | upcase" %}`,
        `{{ ${value}|json_encode }}`,
      ]),
    ),
  ),
  fixture(
    'markdown <- javascript',
    'markdown',
    fc.record({
      title: pascalName,
      fnName: camelName,
    }).map(({ title, fnName }) =>
      lines([
        `# ${title}`,
        '',
        '```ts',
        `const ${fnName} = async () => fetch('/api/demo');`,
        '```',
      ]),
    ),
  ),
  fixture(
    'javascript <- markdown',
    'javascript',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `const ${value} = "# Title\\n\\n- one\\n- two";`,
        `export default ${value};`,
      ]),
    ),
  ),
  fixture(
    'javascript <- graphql',
    'javascript',
    fc.record({
      queryName: pascalName,
      value: camelName,
    }).map(({ queryName, value }) =>
      lines([
        'import { gql } from "@apollo/client";',
        `const ${value} = gql\`query ${queryName} { viewer { id } }\`;`,
        `export default ${value};`,
      ]),
    ),
  ),
  fixture(
    'python <- sql',
    'python',
    fc.record({
      fnName: snakeName,
      table: lowerWord,
    }).map(({ fnName, table }) =>
      lines([
        `def ${fnName}(db):`,
        `    query = "select id, name from ${table} where active = 1"`,
        '    return db.execute(query)',
      ]),
    ),
  ),
  fixture(
    'yaml <- bash',
    'yaml',
    fc.record({
      service: lowerWord,
    }).map(({ service }) =>
      lines([
        'services:',
        `  ${service}:`,
        '    command: |',
        '      echo "hello"',
        '      node server.js',
      ]),
    ),
  ),
  fixture(
    'bash <- yaml',
    'bash',
    fc.record({
      value: lowerWord,
    }).map(({ value }) =>
      lines([
        'echo "services:"',
        'echo "  app:"',
        `for file in ./${value}/*.ts; do echo "$file"; done`,
      ]),
    ),
  ),
];
