import { describe, expect, it } from 'vitest';
import { normalizeCodeBlockLanguage } from '../../plugins/code/codeBlockLanguage';
import { guessLanguage } from './index';

interface AdversarialCase {
  language: string;
  sample: string;
}

const cases: readonly AdversarialCase[] = [
  { language: 'javascript', sample: 'items.map((item) => item.id)' },
  { language: 'javascript', sample: "import React from 'react';\nexport default function App() { return null; }" },
  { language: 'typescript', sample: 'type User = { id: string; name: string }' },
  { language: 'typescript', sample: 'type Config<T> = {\n  value: T;\n};\nconst pickConfig = <T>(input: Config<T>): T => input.value;' },
  { language: 'python', sample: '[item.strip() for item in values]' },
  { language: 'ruby', sample: 'items.each { |item| puts item }' },
  { language: 'ruby', sample: 'module Admin\n  class User\n  end\nend' },
  { language: 'ruby', sample: 'require \'redcarpet\'\nmarkdown = Redcarpet.new("Hello World!")\nputs markdown.to_html' },
  { language: 'bash', sample: 'find . -name "*.ts" | xargs grep TODO' },
  { language: 'bash', sample: 'alpha="value"\nprintf "%s\\n" "$value"' },
  { language: 'go', sample: 'client, err := load()' },
  { language: 'rust', sample: 'println!("{}", value);' },
  { language: 'swift', sample: 'guard let value = item else { return nil }' },
  { language: 'kotlin', sample: 'data class User(val name: String)' },
  { language: 'lua', sample: 'local value = table.concat(items, ",")' },
  { language: 'lua', sample: 'function render(item)\n  return item\nend' },
  { language: 'powershell', sample: 'Get-ChildItem | Select-Object Name' },
  { language: 'makefile', sample: '.PHONY: build\nbuild:\n\tpnpm build' },
  { language: 'dotenv', sample: 'DATABASE_URL=postgres://localhost:5432/app' },
  { language: 'yaml', sample: '- name: app\n  port: 3000' },
  { language: 'toml', sample: 'enabled = true' },
  { language: 'terraform', sample: 'provider "aws" {}' },
  { language: 'prisma', sample: 'model User { id Int @id }' },
  { language: 'markdown', sample: '- one\n- two' },
  { language: 'markdown', sample: '| alpha | beta |\n| --- | --- |\n| beta | alpha |' },
  { language: 'vue', sample: '<template><button @click="open">{{ label }}</button></template>' },
  { language: 'svelte', sample: '{#if ready}<p>{value}</p>{/if}' },
  { language: 'astro', sample: '---\nconst title = Astro.props.title;\n---\n<h1>{title}</h1>' },
  { language: 'mdx', sample: 'import { Demo } from "./demo"\n\n# Title\n\n<Demo />' },
  { language: 'handlebars', sample: '{{#if user}}{{user}}{{/if}}' },
  { language: 'liquid', sample: '{{ title | upcase }}' },
  { language: 'liquid', sample: '{% for entry in site.posts %}\n{{ entry.title | escape }}\n{% endfor %}' },
  { language: 'jinja', sample: '{% extends "base.html" %}\n{{ title|safe }}' },
  { language: 'jinja', sample: '{% for entry in posts %}\n{{ entry.summary|truncate }}\n{% endfor %}' },
  { language: 'jinja', sample: '{% if user %}\n{{ user.title|escape }}\n{% endif %}' },
  { language: 'twig', sample: '{{ item|merge(extra)|json_encode }}' },
  { language: 'twig', sample: '{% for item in users|filter(v => v.active) %}\n{{ item.name|merge(extra)|json_encode }}\n{% endfor %}' },
  { language: 'html', sample: '<section><h1>Title</h1></section>' },
  { language: 'css', sample: ':root { --color: #fff; }' },
  { language: 'scss', sample: '.item {\n  &--active { color: red; }\n}' },
  { language: 'stylus', sample: 'button\n  color red' },
  { language: 'postcss', sample: '.card {\n  color: theme(colors.red.500);\n}' },
  { language: 'xml', sample: '<feed><entry>1</entry></feed>' },
  { language: 'graphql', sample: '{ user { id name } }' },
  { language: 'json', sample: '[1, 2, 3]' },
  { language: 'sql', sample: 'select id, name from users where id = 1;' },
  { language: 'terraform', sample: 'terraform {\n  required_version = "\u003e= 1.0"\n}' },
  { language: 'protobuf', sample: 'package demo;\noption go_package = "demo/api";\nenum Status { READY = 0; }' },
  { language: 'php', sample: 'function render($title) {\n  return $title;\n}' },
  { language: 'php', sample: 'namespace App\\User;\nclass User {}' },
  { language: 'c', sample: '#include <stdio.h>\nint main(void) {\n  printf("hi\\n");\n  return 0;\n}' },
  { language: 'fsharp', sample: 'let numbers = [1..5] |> List.filter (fun value -> value > 2)\nprintfn "%A" numbers' },
  { language: 'fsharp', sample: 'match entries with\n| [] -> printfn "empty"\n| head :: tail -> printfn "%A" head' },
  { language: 'haskell', sample: 'main :: IO ()\nmain = print [x ^ 2 | x <- [1..5]]' },
  { language: 'julia', sample: 'values = [x^2 for x in 1:10]' },
  { language: 'julia', sample: 'struct Point\n  value::Int\nend' },
  { language: 'julia', sample: 'function render(values)\n  sum(values)\nend' },
  { language: 'matlab', sample: 'values = [1 2 3; 4 5 6];\ndisp(size(values));' },
  { language: 'matlab', sample: 'rows = linspace(0, 1, 10);\nplot(rows, rows.^2);' },
  { language: 'matlab', sample: 'points = zeros(3, 3);\npoints(1, :) = 1;' },
  { language: 'nim', sample: 'from strutils import strip\nproc render(value: string): string =\n  result = value.strip()' },
  { language: 'nim', sample: 'type UserRef = object\n  name: string\n  enabled: bool' },
  { language: 'nim', sample: 'when isMainModule:\n  echo "alpha"' },
  { language: 'nim', sample: 'let items = @[1, 2, 3]\nfor item in items:\n  echo item' },
  { language: 'ocaml', sample: 'let rec sum value =\n  if value <= 0 then 0 else value + sum (value - 1)' },
  { language: 'ocaml', sample: 'type state =\n  | Ready\n  | Pending' },
  { language: 'ocaml', sample: 'let items = [1; 2; 3]\nList.map (fun value -> value + 1) items' },
  { language: 'r', sample: 'data <- data.frame(value = c(1, 2, 3))\nsummary(data)' },
  { language: 'zig', sample: 'pub fn echo() i32 { return 1; }' },
];

describe('guessLanguage adversarial snippets', () => {
  it('keeps hard short snippets classified correctly', () => {
    const failures: string[] = [];

    for (const testCase of cases) {
      const actual = guessLanguage(testCase.sample);
      const normalizedActual = normalizeCodeBlockLanguage(actual) ?? actual;
      const normalizedExpected = normalizeCodeBlockLanguage(testCase.language) ?? testCase.language;

      if (normalizedActual !== normalizedExpected) {
        failures.push(`${testCase.language}: actual=${actual ?? 'null'} sample=${testCase.sample.replace(/\n/g, '\\n')}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
