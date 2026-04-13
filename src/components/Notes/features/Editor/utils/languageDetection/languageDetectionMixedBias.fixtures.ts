import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionMixedBiasFixture {
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

const routeWord = fc.constantFrom('users', 'notes', 'tasks', 'reports', 'sessions');
const quotedLower = lowerWord.map((value) => `"${value}"`);

function lines(parts: readonly string[]) {
  return parts.join('\n');
}

function fixture(
  language: string,
  arbitrary: Arbitrary<string>,
  sampleCount = 24,
  minimumAccuracy = 1,
): LanguageDetectionMixedBiasFixture {
  return {
    language,
    arbitrary,
    sampleCount,
    minimumAccuracy,
  };
}

export const LANGUAGE_DETECTION_MIXED_BIAS_SEED = 20260404;

export const languageDetectionMixedBiasFixtures: readonly LanguageDetectionMixedBiasFixture[] = [
  fixture(
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
    'html',
    fc.record({
      route: routeWord,
      value: camelName,
    }).map(({ route, value }) =>
      lines([
        '<section>',
        `  <button data-route="${route}">Open</button>`,
        '  <script>',
        `    const ${value} = document.querySelector('button');`,
        '  </script>',
        '</section>',
      ]),
    ),
  ),
  fixture(
    'vue',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '<template>',
        `  <button @click="${value}++">{{ ${value} }}</button>`,
        '</template>',
        '<script setup lang="ts">',
        `const ${value} = ref(0);`,
        '</script>',
      ]),
    ),
  ),
  fixture(
    'svelte',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '<script>',
        `  let ${value} = 0;`,
        '</script>',
        '',
        `<button on:click={() => ${value} += 1}>{${value}}</button>`,
      ]),
    ),
  ),
  fixture(
    'astro',
    fc.record({
      componentName: pascalName,
      title: camelName,
    }).map(({ componentName, title }) =>
      lines([
        '---',
        `import ${componentName} from '../components/${componentName}.astro';`,
        `const ${title} = Astro.props.title;`,
        '---',
        `<${componentName} title={${title}} />`,
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
        '# Title',
        '',
        `<${componentName} />`,
      ]),
    ),
  ),
  fixture(
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
    'php',
    fc.record({
      value: camelName,
      route: routeWord,
    }).map(({ value, route }) =>
      lines([
        '<?php',
        `$${value} = "<section data-route=\\"${route}\\"></section>";`,
        `echo $${value};`,
      ]),
    ),
  ),
  fixture(
    'liquid',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '<div>',
        `{% assign ${value} = product.title %}`,
        `{{ ${value} | upcase | escape }}`,
        '</div>',
      ]),
    ),
  ),
  fixture(
    'twig',
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '<section>',
        `{% set ${value} = items|merge(extra) %}`,
        `{{ ${value}|json_encode }}`,
        '</section>',
      ]),
    ),
  ),
  fixture(
    'dockerfile',
    fc.record({
      image: fc.constantFrom('node:20-alpine', 'python:3.12-slim'),
    }).map(({ image }) =>
      lines([
        `FROM ${image}`,
        'RUN echo "const app = 1;" && npm ci',
      ]),
    ),
  ),
  fixture(
    'toml',
    fc.record({
      name: lowerWord,
      author: quotedLower,
    }).map(({ name, author }) =>
      lines([
        '[package]',
        `name = "${name}"`,
        `authors = [${author}]`,
      ]),
    ),
  ),
];
