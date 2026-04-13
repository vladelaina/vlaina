import fc, { type Arbitrary } from 'fast-check';

export interface LanguageDetectionFixture {
  language: string;
  minimumAccuracy: number;
  sampleCount: number;
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

const envWord = fc.constantFrom('APP_PORT', 'DB_HOST', 'API_TOKEN', 'LOG_LEVEL', 'CACHE_TTL');
const imageWord = fc.constantFrom('node:20-alpine', 'python:3.12-slim', 'golang:1.24-alpine');
const tableWord = fc.constantFrom('users', 'notes', 'sessions', 'events', 'jobs');
const colorWord = fc.constantFrom('#0f172a', '#1d4ed8', '#16a34a', '#f97316', '#dc2626');
const routeWord = fc.constantFrom('users', 'notes', 'tasks', 'reports', 'sessions');
const fieldWord = fc.constantFrom('id', 'name', 'email', 'title', 'status');
const httpMethod = fc.constantFrom('get', 'post', 'put', 'delete');
const scalarType = fc.constantFrom('string', 'number', 'boolean');
const sqlType = fc.constantFrom('INT', 'BIGINT', 'VARCHAR(255)', 'TIMESTAMP');
const portNumber = fc.integer({ min: 3000, max: 9999 });
const smallNumber = fc.integer({ min: 1, max: 999 });

const camelName = fc
  .tuple(lowerWord, fc.array(pascalWord, { minLength: 0, maxLength: 2 }))
  .map(([head, tail]) => [head, ...tail].join(''));

const snakeName = fc
  .tuple(lowerWord, fc.array(lowerWord, { minLength: 1, maxLength: 2 }))
  .map(([head, tail]) => [head, ...tail].join('_'));

const kebabName = fc
  .tuple(lowerWord, fc.array(lowerWord, { minLength: 1, maxLength: 2 }))
  .map(([head, tail]) => [head, ...tail].join('-'));

const pascalName = fc
  .tuple(pascalWord, fc.array(pascalWord, { minLength: 0, maxLength: 1 }))
  .map(([head, tail]) => [head, ...tail].join(''));

const quotedText = lowerWord.map((word) => `"${word}"`);

function lines(parts: readonly string[]) {
  return parts.join('\n');
}

function fixture(
  language: string,
  arbitrary: Arbitrary<string>,
  sampleCount = 36,
  minimumAccuracy = 1,
): LanguageDetectionFixture {
  return {
    language,
    arbitrary,
    minimumAccuracy,
    sampleCount,
  };
}

const javascriptFixture = fixture(
  'javascript',
  fc.oneof(
    fc.record({
      moduleName: quotedText,
      handlerName: camelName,
      route: routeWord,
      resource: camelName,
      value: lowerWord,
      method: httpMethod,
    }).map(({ moduleName, handlerName, route, resource, value, method }) =>
      lines([
        `import ${resource} from ${moduleName};`,
        `const ${handlerName} = async (${resource}) => {`,
        `  const response = await fetch('/${route}');`,
        `  return { value: ${resource}.${value}, ok: response.ok };`,
        '};',
        `app.${method}('/${route}', (${resource}, res) => {`,
        `  res.json(${handlerName}(${resource}));`,
        '});',
      ]),
    ),
    fc.record({
      collection: camelName,
      item: camelName,
      label: quotedText,
    }).map(({ collection, item, label }) =>
      lines([
        `const ${collection} = [${label}, "beta", "gamma"];`,
        `const ${item} = ${collection}.map((entry) => entry.toUpperCase());`,
        `console.log(${item}.join(','));`,
      ]),
    ),
  ),
);

const typescriptFixture = fixture(
  'typescript',
  fc.oneof(
    fc.record({
      modelName: pascalName,
      fnName: camelName,
      field: camelName,
      typeName: scalarType,
    }).map(({ modelName, fnName, field, typeName }) =>
      lines([
        `interface ${modelName} {`,
        `  ${field}: ${typeName};`,
        '}',
        `export function ${fnName}(input: ${modelName}): ${typeName} {`,
        `  return input.${field};`,
        '}',
      ]),
    ),
    fc.record({
      serviceName: pascalName,
      dependencyName: pascalName,
      paramName: camelName,
    }).map(({ serviceName, dependencyName, paramName }) =>
      lines([
        `type ${dependencyName} = { request(id: number): Promise<string> };`,
        `class ${serviceName} {`,
        `  constructor(private client: ${dependencyName}) {}`,
        `  async load(${paramName}: number): Promise<string> {`,
        `    return this.client.request(${paramName});`,
        '  }',
        '}',
      ]),
    ),
  ),
);

const pythonFixture = fixture(
  'python',
  fc.oneof(
    fc.record({
      moduleName: snakeName,
      className: pascalName,
      funcName: snakeName,
      field: snakeName,
      value: lowerWord,
    }).map(({ moduleName, className, funcName, field, value }) =>
      lines([
        `from ${moduleName} import ${className}`,
        '',
        `def ${funcName}(${field}: str) -> str:`,
        `    return ${field}.strip() + "${value}"`,
        '',
        `print(${funcName}("demo"))`,
      ]),
    ),
    fc.record({
      className: pascalName,
      field: snakeName,
    }).map(({ className, field }) =>
      lines([
        `class ${className}:`,
        `    def __init__(self, ${field}: str) -> None:`,
        `        self.${field} = ${field}`,
        '',
        `    def render(self) -> str:`,
        `        return self.${field}`,
      ]),
    ),
  ),
);

const goFixture = fixture(
  'go',
  fc.oneof(
    fc.record({
      packageName: lowerWord,
      funcName: pascalName,
      value: quotedText,
    }).map(({ packageName, funcName, value }) =>
      lines([
        `package ${packageName}`,
        '',
        'import "fmt"',
        '',
        `func ${funcName}() {`,
        `    message := ${value}`,
        '    fmt.Println(message)',
        '}',
      ]),
    ),
    fc.record({
      structName: pascalName,
      fieldName: pascalName,
      errName: camelName,
    }).map(({ structName, fieldName, errName }) =>
      lines([
        'package main',
        '',
        `type ${structName} struct {`,
        `    ${fieldName} string`,
        '}',
        '',
        'func main() {',
        `    _, ${errName} := loadValue()`,
        `    if ${errName} != nil {`,
        `        panic(${errName})`,
        '    }',
        '}',
      ]),
    ),
  ),
);

const rustFixture = fixture(
  'rust',
  fc.oneof(
    fc.record({
      structName: pascalName,
      fieldName: snakeName,
    }).map(({ structName, fieldName }) =>
      lines([
        `struct ${structName} {`,
        `    ${fieldName}: String,`,
        '}',
        '',
        `impl ${structName} {`,
        '    fn render(&self) -> &str {',
        `        &self.${fieldName}`,
        '    }',
        '}',
      ]),
    ),
    fc.record({
      value: smallNumber,
    }).map(({ value }) =>
      lines([
        'use std::collections::HashMap;',
        '',
        'fn main() {',
        '    let mut items: HashMap<String, i32> = HashMap::new();',
        `    items.insert("count".to_string(), ${value});`,
        '    println!("{}", items.len());',
        '}',
      ]),
    ),
  ),
);

const javaFixture = fixture(
  'java',
  fc.record({
    packageName: lowerWord,
    className: pascalName,
    value: quotedText,
  }).map(({ packageName, className, value }) =>
    lines([
      `package ${packageName};`,
      '',
      `public class ${className} {`,
      '    public static void main(String[] args) {',
      `        System.out.println(${value});`,
      '    }',
      '}',
    ]),
  ),
);

const csharpFixture = fixture(
  'csharp',
  fc.oneof(
    fc.record({
      namespaceName: pascalName,
      className: pascalName,
      value: quotedText,
    }).map(({ namespaceName, className, value }) =>
      lines([
        'using System;',
        '',
        `namespace ${namespaceName};`,
        '',
        `public class ${className}`,
        '{',
        '    public static void Main(string[] args)',
        '    {',
        `        Console.WriteLine(${value});`,
        '    }',
        '}',
      ]),
    ),
    fc.record({
      className: pascalName,
      fieldName: camelName,
    }).map(({ className, fieldName }) =>
      lines([
        `public class ${className}`,
        '{',
        `    public string ${fieldName} { get; set; } = string.Empty;`,
        '}',
      ]),
    ),
  ),
);

const phpFixture = fixture(
  'php',
  fc.record({
    funcName: camelName,
    paramName: camelName,
  }).map(({ funcName, paramName }) =>
    lines([
      '<?php',
      `function ${funcName}($${paramName}) {`,
      `    echo $${paramName};`,
      '}',
    ]),
  ),
);

const rubyFixture = fixture(
  'ruby',
  fc.oneof(
    fc.record({
      className: pascalName,
      fieldName: snakeName,
    }).map(({ className, fieldName }) =>
      lines([
        `class ${className}`,
        `  attr_reader :${fieldName}`,
        '',
        `  def initialize(${fieldName})`,
        `    @${fieldName} = ${fieldName}`,
        '  end',
        'end',
      ]),
    ),
    fc.record({
      modelName: pascalName,
      relation: snakeName,
    }).map(({ modelName, relation }) =>
      lines([
        `class ${modelName} < ApplicationRecord`,
        `  has_many :${relation}, dependent: :destroy`,
        `  scope :recent, -> { order(created_at: :desc) }`,
        'end',
      ]),
    ),
  ),
);

const bashFixture = fixture(
  'bash',
  fc.oneof(
    fc.record({
      dirName: lowerWord,
    }).map(({ dirName }) =>
      lines([
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        `for file in ./${dirName}/*.ts; do`,
        '  echo "$file"',
        'done',
      ]),
    ),
    fc.record({
      command: fc.constantFrom('curl', 'docker', 'git', 'npm'),
      target: quotedText,
    }).map(({ command, target }) => `${command} ${target}`),
  ),
);

const sqlFixture = fixture(
  'sql',
  fc.oneof(
    fc.record({
      tableName: tableWord,
      columnName: fieldWord,
      columnType: sqlType,
    }).map(({ tableName, columnName, columnType }) =>
      lines([
        `CREATE TABLE ${tableName} (`,
        `  ${columnName} ${columnType} PRIMARY KEY,`,
        '  created_at TIMESTAMP NOT NULL',
        ');',
      ]),
    ),
    fc.record({
      tableName: tableWord,
      columnName: fieldWord,
      value: quotedText,
    }).map(({ tableName, columnName, value }) =>
      `SELECT ${columnName} FROM ${tableName} WHERE ${columnName} = ${value};`,
    ),
  ),
);

const jsonFixture = fixture(
  'json',
  fc.record({
    name: lowerWord,
    count: smallNumber,
    enabled: fc.boolean(),
  }).map(({ name, count, enabled }) =>
    JSON.stringify(
      {
        name,
        count,
        enabled,
        tags: [name, 'beta'],
      },
      null,
      2,
    ),
  ),
);

const yamlFixture = fixture(
  'yaml',
  fc.oneof(
    fc.record({
      name: kebabName,
      port: portNumber,
    }).map(({ name, port }) =>
      lines([
        'apiVersion: v1',
        'kind: Service',
        'metadata:',
        `  name: ${name}`,
        'spec:',
        '  ports:',
        `    - port: ${port}`,
      ]),
    ),
    fc.record({
      serviceName: lowerWord,
      image: imageWord,
    }).map(({ serviceName, image }) =>
      lines([
        'version: "3.9"',
        'services:',
        `  ${serviceName}:`,
        `    image: ${image}`,
        '    ports:',
        '      - "3000:3000"',
      ]),
    ),
  ),
);

const tomlFixture = fixture(
  'toml',
  fc.oneof(
    fc.record({
      name: kebabName,
      version: fc.constantFrom('0.1.0', '1.2.3', '2.0.1'),
    }).map(({ name, version }) =>
      lines([
        '[package]',
        `name = "${name}"`,
        `version = "${version}"`,
        'authors = ["vlaina"]',
      ]),
    ),
    fc.record({
      section: kebabName,
      host: lowerWord,
      port: portNumber,
    }).map(({ section, host, port }) =>
      lines([
        `[${section}]`,
        `host = "${host}"`,
        `port = ${port}`,
        'enabled = true',
      ]),
    ),
  ),
);

const htmlFixture = fixture(
  'html',
  fc.record({
    className: kebabName,
    title: pascalName,
    bodyText: lowerWord,
  }).map(({ className, title, bodyText }) =>
    lines([
      '<!DOCTYPE html>',
      '<html>',
      '  <body>',
      `    <section class="${className}">`,
      `      <h1>${title}</h1>`,
      `      <p>${bodyText}</p>`,
      '    </section>',
      '  </body>',
      '</html>',
    ]),
  ),
);

const cssFixture = fixture(
  'css',
  fc.oneof(
    fc.record({
      className: kebabName,
      color: colorWord,
    }).map(({ className, color }) =>
      lines([
        `.${className} {`,
        '  display: flex;',
        `  color: ${color};`,
        '  padding: 12px;',
        '}',
      ]),
    ),
    fc.record({
      idName: camelName,
      color: colorWord,
    }).map(({ idName, color }) =>
      lines([
        `#${idName} {`,
        `  background: ${color};`,
        '  border-radius: 8px;',
        '}',
      ]),
    ),
  ),
);

const xmlFixture = fixture(
  'xml',
  fc.record({
    rootName: lowerWord,
    fieldName: lowerWord,
    value: lowerWord,
  }).map(({ rootName, fieldName, value }) =>
    lines([
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<${rootName}>`,
      `  <${fieldName}>${value}</${fieldName}>`,
      `</${rootName}>`,
    ]),
  ),
);

const graphqlFixture = fixture(
  'graphql',
  fc.oneof(
    fc.record({
      queryName: pascalName,
      fieldName: camelName,
      variableName: camelName,
    }).map(({ queryName, fieldName, variableName }) =>
      lines([
        `query ${queryName}($${variableName}: ID!) {`,
        `  ${fieldName}(id: $${variableName}) {`,
        '    id',
        '    name',
        '  }',
        '}',
      ]),
    ),
    fc.record({
      typeName: pascalName,
      fieldName: camelName,
    }).map(({ typeName, fieldName }) =>
      lines([
        `type ${typeName} {`,
        '  id: ID!',
        `  ${fieldName}: String!`,
        '}',
      ]),
    ),
  ),
);

const dockerfileFixture = fixture(
  'dockerfile',
  fc.record({
    image: imageWord,
    workdir: lowerWord,
    envName: envWord,
    port: portNumber,
  }).map(({ image, workdir, envName, port }) =>
    lines([
      `FROM ${image}`,
      `WORKDIR /app/${workdir}`,
      'COPY package.json ./',
      `ENV ${envName}=${port}`,
      'RUN pnpm install',
      `EXPOSE ${port}`,
    ]),
  ),
);

const kotlinFixture = fixture(
  'kotlin',
  fc.oneof(
    fc.record({
      className: pascalName,
      fieldName: camelName,
    }).map(({ className, fieldName }) =>
      lines([
        `data class ${className}(val ${fieldName}: String)`,
        '',
        `fun render(item: ${className}): String {`,
        `    return item.${fieldName}`,
        '}',
      ]),
    ),
    fc.record({
      packageName: lowerWord,
      className: pascalName,
    }).map(({ packageName, className }) =>
      lines([
        `package app.${packageName}`,
        '',
        'import kotlin.collections.List',
        '',
        `class ${className} {`,
        '    suspend fun load(): List<String> {',
        '        return listOf("alpha", "beta")',
        '    }',
        '}',
      ]),
    ),
  ),
);

const swiftFixture = fixture(
  'swift',
  fc.oneof(
    fc.record({
      viewName: pascalName,
      stateName: camelName,
    }).map(({ viewName, stateName }) =>
      lines([
        'import SwiftUI',
        '',
        `struct ${viewName}: View {`,
        `    @State private var ${stateName} = ""`,
        '',
        '    var body: some View {',
        `        Text(${stateName})`,
        '    }',
        '}',
      ]),
    ),
    fc.record({
      funcName: camelName,
    }).map(({ funcName }) =>
      lines([
        'import Foundation',
        '',
        `func ${funcName}(value: String) -> String {`,
        '    guard let first = value.first else { return value }',
        '    return String(first)',
        '}',
      ]),
    ),
  ),
);

const luaFixture = fixture(
  'lua',
  fc.oneof(
    fc.record({
      varName: camelName,
      funcName: camelName,
    }).map(({ varName, funcName }) =>
      lines([
        `local ${varName} = "alpha"`,
        '',
        `function ${funcName}(value)`,
        '  return value',
        'end',
      ]),
    ),
    fc.record({
      itemName: camelName,
    }).map(({ itemName }) =>
      lines([
        `local ${itemName} = table.concat({ "a", "b" }, ",")`,
        'for index, value in ipairs({ "x", "y" }) do',
        '  print(index, value)',
        'end',
      ]),
    ),
  ),
);

const powershellFixture = fixture(
  'powershell',
  fc.oneof(
    fc.record({
      functionName: pascalName,
      varName: camelName,
    }).map(({ functionName, varName }) =>
      lines([
        `function Get-${functionName}`,
        'param($Path)',
        `$${varName} = Get-ChildItem -Path $Path`,
        `$${varName} | ForEach-Object { $_.Name }`,
      ]),
    ),
    fc.record({
      varName: camelName,
    }).map(({ varName }) =>
      lines([
        `[CmdletBinding()]`,
        'param([string]$Path)',
        `$${varName} = Get-Item -Path $Path`,
        `Write-Host $${varName}.FullName`,
      ]),
    ),
  ),
);

const makefileFixture = fixture(
  'makefile',
  fc.oneof(
    fc.record({
      appName: lowerWord,
    }).map(({ appName }) =>
      lines([
        `APP_NAME = ${appName}`,
        'PORT ?= 3000',
        '',
        '.PHONY: dev',
        'dev:',
        '\tpnpm dev',
      ]),
    ),
    fc.record({
      binaryName: lowerWord,
    }).map(({ binaryName }) =>
      lines([
        `BINARY = ${binaryName}`,
        '',
        'build: deps',
        '\tgo build -o $(BINARY)',
        '',
        'deps:',
        '\tgo mod download',
      ]),
    ),
  ),
);

const dotenvFixture = fixture(
  'dotenv',
  fc.record({
    host: lowerWord,
    port: portNumber,
  }).map(({ host, port }) =>
    lines([
      `APP_URL=https://${host}.example.com`,
      `DB_HOST=${host}`,
      `APP_PORT=${port}`,
    ]),
  ),
);

const terraformFixture = fixture(
  'terraform',
  fc.oneof(
    fc.record({
      resourceName: snakeName,
      bucketName: kebabName,
    }).map(({ resourceName, bucketName }) =>
      lines([
        `resource "aws_s3_bucket" "${resourceName}" {`,
        `  bucket = "${bucketName}"`,
        '}',
      ]),
    ),
    fc.record({
      variableName: snakeName,
    }).map(({ variableName }) =>
      lines([
        `variable "${variableName}" {`,
        '  type = string',
        '}',
        '',
        'output "value" {',
        `  value = var.${variableName}`,
        '}',
      ]),
    ),
  ),
);

const cmakeFixture = fixture(
  'cmake',
  fc.record({
    projectName: pascalName,
  }).map(({ projectName }) =>
    lines([
      'cmake_minimum_required(VERSION 3.28)',
      `project(${projectName})`,
      `add_executable(${projectName} main.cpp)`,
      `target_link_libraries(${projectName} PRIVATE Threads::Threads)`,
    ]),
  ),
);

const prismaFixture = fixture(
  'prisma',
  fc.record({
    modelName: pascalName,
  }).map(({ modelName }) =>
    lines([
      'datasource db {',
      '  provider = "postgresql"',
      '  url      = env("DATABASE_URL")',
      '}',
      '',
      `model ${modelName} {`,
      '  id   Int    @id @default(autoincrement())',
      '  name String @unique',
      '}',
    ]),
  ),
);

const markdownFixture = fixture(
  'markdown',
  fc.record({
    title: pascalName,
    section: pascalName,
  }).map(({ title, section }) =>
    lines([
      `# ${title}`,
      '',
      `## ${section}`,
      '',
      '- item one',
      '- item two',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ]),
  ),
);

const vueFixture = fixture(
  'vue',
  fc.record({
    componentName: pascalName,
    label: lowerWord,
  }).map(({ componentName, label }) =>
    lines([
      '<template>',
      `  <button @click="submit" :class="['${label}']">{{ message }}</button>`,
      '</template>',
      '',
      '<script setup>',
      `import ${componentName} from './${componentName}.vue';`,
      'const message = "hello";',
      '</script>',
    ]),
  ),
);

const svelteFixture = fixture(
  'svelte',
  fc.record({
    stateName: camelName,
  }).map(({ stateName }) =>
    lines([
      '<script>',
      `  export let ${stateName} = "hello";`,
      `  $: upper = ${stateName}.toUpperCase();`,
      '</script>',
      '',
      `{#if ${stateName}}`,
      `  <input bind:value={${stateName}} />`,
      '{/if}',
    ]),
  ),
);

const astroFixture = fixture(
  'astro',
  fc.record({
    componentName: pascalName,
  }).map(({ componentName }) =>
    lines([
      '---',
      `import ${componentName} from '../components/${componentName}.astro';`,
      'const title = Astro.props.title;',
      '---',
      '',
      '<main>',
      `  <${componentName} title={title} />`,
      '</main>',
    ]),
  ),
);

const mdxFixture = fixture(
  'mdx',
  fc.record({
    componentName: pascalName,
    title: pascalName,
  }).map(({ componentName, title }) =>
    lines([
      `import { ${componentName} } from './components';`,
      '',
      `# ${title}`,
      '',
      `<${componentName} />`,
      '',
      '{Math.max(1, 2)}',
    ]),
  ),
);

const handlebarsFixture = fixture(
  'handlebars',
  fc.record({
    itemName: camelName,
  }).map(({ itemName }) =>
    lines([
      `{{#if ${itemName}}}`,
      `  <p>{{${itemName}}}</p>`,
      '{{/if}}',
      '{{> footer}}',
    ]),
  ),
);

const liquidFixture = fixture(
  'liquid',
  fc.record({
    itemName: camelName,
  }).map(({ itemName }) =>
    lines([
      `{% assign ${itemName} = product.title %}`,
      `{{ ${itemName} | upcase | escape }}`,
      '{% if product.available %}',
      '  {{ product.price | money }}',
      '{% endif %}',
    ]),
  ),
);

const jinjaFixture = fixture(
  'jinja',
  fc.record({
    title: camelName,
  }).map(({ title }) =>
    lines([
      '{% extends "base.html" %}',
      '{% block content %}',
      `  <h1>{{ ${title}|safe }}</h1>`,
      '{% endblock %}',
    ]),
  ),
);

const twigFixture = fixture(
  'twig',
  fc.record({
    itemName: camelName,
  }).map(({ itemName }) =>
    lines([
      '{% extends "base.html.twig" %}',
      '{% block content %}',
      `  {{ ${itemName}|merge(extra)|json_encode }}`,
      '{% endblock %}',
    ]),
  ),
);

const dartFixture = fixture(
  'dart',
  fc.oneof(
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        "import 'package:flutter/material.dart';",
        '',
        `class ${className} extends StatelessWidget {`,
        '  @override',
        '  Widget build(BuildContext context) {',
        '    return const Text("hello");',
        '  }',
        '}',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        'void main() {',
        `  final ${value} = "hello";`,
        `  print(${value});`,
        '}',
      ]),
    ),
  ),
);

const apacheFixture = fixture(
  'apache',
  fc.oneof(
    fc.record({
      host: lowerWord,
      path: lowerWord,
      port: portNumber,
    }).map(({ host, path, port }) =>
      lines([
        `<VirtualHost *:${port}>`,
        `  ServerName ${host}.example.com`,
        `  DocumentRoot "/var/www/${path}"`,
        '  RewriteEngine On',
        '</VirtualHost>',
      ]),
    ),
    fc.record({
      source: lowerWord,
      target: lowerWord,
    }).map(({ source, target }) =>
      lines([
        'RewriteEngine On',
        `RewriteCond %{REQUEST_URI} ^/${source}$`,
        `RewriteRule ^${source}$ /${target} [L,R=302]`,
      ]),
    ),
  ),
);

const elmFixture = fixture(
  'elm',
  fc.oneof(
    fc.record({
      moduleName: pascalName,
      viewName: camelName,
    }).map(({ moduleName, viewName }) =>
      lines([
        `module ${moduleName} exposing (main)`,
        '',
        'import Html exposing (Html, div, text)',
        '',
        `${viewName} : Html msg`,
        `${viewName} =`,
        '    div [] [ text "hello" ]',
        '',
        'main =',
        `    ${viewName}`,
      ]),
    ),
    fc.record({
      aliasName: pascalName,
      fieldName: camelName,
    }).map(({ aliasName, fieldName }) =>
      lines([
        'module Main exposing (Model, update)',
        '',
        'import Html exposing (Html, button, div, text)',
        'import Html.Events exposing (onClick)',
        '',
        `type alias ${aliasName} =`,
        `    { ${fieldName} : Int }`,
        '',
        'type Msg',
        '    = Increment',
        '',
        'update : Msg -> Model -> Model',
        'update msg model =',
        '    case msg of',
        '        Increment ->',
        `            { model | ${fieldName} = model.${fieldName} + 1 }`,
      ]),
    ),
  ),
);

const fsharpFixture = fixture(
  'fsharp',
  fc.oneof(
    fc.record({
      namespaceName: pascalName,
      moduleName: pascalName,
    }).map(({ namespaceName, moduleName }) =>
      lines([
        `namespace ${namespaceName}`,
        '',
        'open System',
        '',
        `module ${moduleName} =`,
        '    let mutable count = 0',
        '    let items = [1..10] |> List.map (fun x -> x * 2)',
        '    printfn "%A" items',
      ]),
    ),
    fc.record({
      valueName: camelName,
    }).map(({ valueName }) =>
      lines([
        `let ${valueName} : int = 42`,
        'let numbers = [1..5] |> List.filter (fun value -> value > 2)',
        'printfn "%A" numbers',
      ]),
    ),
  ),
);

const gdscriptFixture = fixture(
  'gdscript',
  fc.oneof(
    fc.record({
      signalName: snakeName,
    }).map(({ signalName }) =>
      lines([
        'extends Node',
        '',
        `signal ${signalName}(value)`,
        'onready var label = $Label',
        '',
        'func _ready():',
        `    emit_signal("${signalName}", label.text)`,
      ]),
    ),
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        `class_name ${className}`,
        'extends Node2D',
        '',
        'var velocity = Vector2(0, 1)',
        '',
        'func _process(delta):',
        '    position += velocity * delta',
      ]),
    ),
  ),
);

const haskellFixture = fixture(
  'haskell',
  fc.oneof(
    fc.record({
      moduleName: pascalName,
      typeName: pascalName,
    }).map(({ moduleName, typeName }) =>
      lines([
        `module ${moduleName} where`,
        '',
        'import qualified Data.Map as Map',
        '',
        `data ${typeName} = Ready | Done deriving (Show, Eq)`,
        '',
        'main :: IO ()',
        'main = print "hello"',
      ]),
    ),
    fc.record({
      fnName: lowerWord,
    }).map(({ fnName }) =>
      lines([
        `${fnName} :: [Int] -> IO ()`,
        `${fnName} items = do`,
        '  print [x ^ 2 | x <- items]',
        '  where squared value = value ^ 2',
      ]),
    ),
  ),
);

const juliaFixture = fixture(
  'julia',
  fc.oneof(
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        `function ${fnName}(value)`,
        '    println(value^2)',
        '    return value + 1',
        'end',
      ]),
    ),
    fc.record({
      valueName: camelName,
    }).map(({ valueName }) =>
      lines([
        `values = [${valueName}^2 for ${valueName} in 1:10]`,
        '@time println(values)',
      ]),
    ),
  ),
);

const matlabFixture = fixture(
  'matlab',
  fc.oneof(
    fc.record({
      fnName: lowerWord,
      valueName: lowerWord,
    }).map(({ fnName, valueName }) =>
      lines([
        `function result = ${fnName}(${valueName})`,
        `    result = zeros(3, 3) + ${valueName};`,
        '    plot(result);',
        'end',
      ]),
    ),
    fc.record({
      matrixName: pascalName,
    }).map(({ matrixName }) =>
      lines([
        `${matrixName} = [1 2 3; 4 5 6; 7 8 9];`,
        `disp(size(${matrixName}));`,
      ]),
    ),
  ),
);

const nimFixture = fixture(
  'nim',
  fc.oneof(
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        'import strutils',
        '',
        `proc ${fnName}*(value: string): string =`,
        '  result = value.strip()',
        '',
        'when defined(windows):',
        `  echo ${fnName}(" demo ")`,
      ]),
    ),
    fc.record({
      valueName: camelName,
    }).map(({ valueName }) =>
      lines([
        'from sequtils import toSeq',
        '',
        `let ${valueName} = toSeq(1..5)`,
        `echo ${valueName}.len`,
      ]),
    ),
  ),
);

const ocamlFixture = fixture(
  'ocaml',
  fc.oneof(
    fc.record({
      fnName: lowerWord,
      valueName: lowerWord,
    }).map(({ fnName, valueName }) =>
      lines([
        `let rec ${fnName} ${valueName} =`,
        `  if ${valueName} <= 0 then 0`,
        `  else ${valueName} + ${fnName} (${valueName} - 1)`,
      ]),
    ),
    fc.record({
      typeName: lowerWord,
      valueName: lowerWord,
    }).map(({ typeName, valueName }) =>
      lines([
        `type ${typeName} = Ready | Done`,
        '',
        `let render ${valueName} =`,
        `  match ${valueName} with`,
        '  | Ready -> "ready"',
        '  | Done -> "done"',
      ]),
    ),
  ),
);

const perlFixture = fixture(
  'perl',
  fc.oneof(
    fc.record({
      packageName: pascalName,
      fnName: lowerWord,
    }).map(({ packageName, fnName }) =>
      lines([
        'use strict;',
        'use warnings;',
        `package ${packageName}::Runner;`,
        '',
        `sub ${fnName} {`,
        '    my $value = shift;',
        '    print $value;',
        '}',
      ]),
    ),
    fc.record({
      valueName: lowerWord,
    }).map(({ valueName }) =>
      lines([
        `my $${valueName} = "alpha";`,
        `$${valueName} =~ s/alpha/beta/;`,
        `print $${valueName};`,
      ]),
    ),
  ),
);

const prologFixture = fixture(
  'prolog',
  fc.oneof(
    fc.record({
      left: lowerWord,
      right: lowerWord,
    }).map(({ left, right }) =>
      lines([
        ':- dynamic parent/2.',
        `parent(${left}, ${right}).`,
        'ancestor(X, Y) :- parent(X, Y).',
      ]),
    ),
    fc.record({
      subject: lowerWord,
    }).map(({ subject }) =>
      lines([
        `fact(${subject}).`,
        `?- fact(${subject}).`,
      ]),
    ),
  ),
);

const rFixture = fixture(
  'r',
  fc.oneof(
    fc.record({
      frameName: camelName,
    }).map(({ frameName }) =>
      lines([
        'library(ggplot2)',
        `data <- data.frame(${frameName} = c(1, 2, 3), value = c(2, 4, 6))`,
        `ggplot(data) + aes(${frameName}, value)`,
      ]),
    ),
    fc.record({
      valueName: camelName,
    }).map(({ valueName }) =>
      lines([
        'library(dplyr)',
        `data <- data.frame(${valueName} = c(1, 2, 3))`,
        `result <- data %>% mutate(${valueName} = ${valueName} + 1)`,
        'summary(result)',
      ]),
    ),
  ),
);

const scalaFixture = fixture(
  'scala',
  fc.oneof(
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        `case class ${className}(name: String)`,
        '',
        `object ${className}App extends App {`,
        `  val items = (1 to 3).map(_ + 1)`,
        '  println(items)',
        '}',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `val ${value} = (1 to 10).filter(_ % 2 == 0)`,
        `println(${value})`,
      ]),
    ),
  ),
);

const zigFixture = fixture(
  'zig',
  fc.oneof(
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        'const std = @import("std");',
        '',
        'pub fn main() !void {',
        `    const ${value} = std.io.getStdOut().writer();`,
        `    try ${value}.print("hello", .{});`,
        '}',
      ]),
    ),
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) => `pub fn ${fnName}() i32 { return 1; }`),
  ),
);

const solidityFixture = fixture(
  'solidity',
  fc.oneof(
    fc.record({
      contractName: pascalName,
    }).map(({ contractName }) =>
      lines([
        'pragma solidity ^0.8.20;',
        '',
        `contract ${contractName} {`,
        '  mapping(address => uint256) public balances;',
        '}',
      ]),
    ),
    fc.record({
      eventName: pascalName,
    }).map(({ eventName }) =>
      lines([
        `event ${eventName}(address indexed user);`,
        'function deposit(address user) public payable returns (uint256) {',
        '  return msg.value;',
        '}',
      ]),
    ),
  ),
);

const elixirFixture = fixture(
  'elixir',
  fc.oneof(
    fc.record({
      moduleName: pascalName,
    }).map(({ moduleName }) =>
      lines([
        `defmodule ${moduleName} do`,
        '  def run(value) do',
        '    value |> String.trim()',
        '  end',
        'end',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `with {:ok, ${value}} <- load() do`,
        `  {:ok, ${value}}`,
        'end',
      ]),
    ),
  ),
);

const erlangFixture = fixture(
  'erlang',
  fc.oneof(
    fc.record({
      moduleName: lowerWord,
    }).map(({ moduleName }) =>
      lines([
        `-module(${moduleName}).`,
        '-export([start/0]).',
        '',
        'start() ->',
        '    ok.',
      ]),
    ),
    fc.record({
      fnName: lowerWord,
    }).map(({ fnName }) =>
      lines([
        `${fnName}(Value) ->`,
        '    lists:map(fun(X) -> X end, Value).',
      ]),
    ),
  ),
);

const latexFixture = fixture(
  'latex',
  fc.oneof(
    fc.record({
      title: pascalName,
    }).map(({ title }) =>
      lines([
        '\\documentclass{article}',
        `\\title{${title}}`,
        '\\begin{document}',
        '\\maketitle',
        '\\end{document}',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) => `\\begin{equation}${value}=mc^2\\end{equation}`),
  ),
);

const objectivecFixture = fixture(
  'objectivec',
  fc.oneof(
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        '#import <Foundation/Foundation.h>',
        '',
        `@interface ${className} : NSObject`,
        '@property (nonatomic, strong) NSString *title;',
        '@end',
      ]),
    ),
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        `#import "${className}.h"`,
        '',
        `@implementation ${className}`,
        '- (void)run {',
        '  NSLog(@"hello");',
        '}',
        '@end',
      ]),
    ),
  ),
);

const scssFixture = fixture(
  'scss',
  fc.oneof(
    fc.record({
      color: colorWord,
      className: kebabName,
    }).map(({ color, className }) =>
      lines([
        `$primary-color: ${color};`,
        `.${className} {`,
        '  color: $primary-color;',
        '  &:hover {',
        '    color: darken($primary-color, 10%);',
        '  }',
        '}',
      ]),
    ),
    fc.record({
      mixinName: camelName,
      size: smallNumber,
    }).map(({ mixinName, size }) =>
      lines([
        `@mixin ${mixinName} {`,
        `  padding: ${size}px;`,
        '}',
        '',
        '.card {',
        `  @include ${mixinName};`,
        '}',
      ]),
    ),
  ),
);

const lessFixture = fixture(
  'less',
  fc.oneof(
    fc.record({
      color: colorWord,
      radius: smallNumber,
    }).map(({ color, radius }) =>
      lines([
        `@primary: ${color};`,
        '',
        `.rounded(@radius) {`,
        '  border-radius: @radius;',
        '}',
        '',
        '.button {',
        `  .rounded(${radius}px);`,
        '  color: darken(@primary, 10%);',
        '}',
      ]),
    ),
    fc.record({
      color: colorWord,
    }).map(({ color }) =>
      lines([
        `@text-color: ${color};`,
        '.panel {',
        '  color: @text-color;',
        '}',
      ]),
    ),
  ),
);

const stylusFixture = fixture(
  'stylus',
  fc.oneof(
    fc.record({
      color: colorWord,
    }).map(({ color }) =>
      lines([
        `primary = ${color}`,
        '',
        'button',
        '  color primary',
        '  padding 12px',
      ]),
    ),
    fc.record({
      className: lowerWord,
    }).map(({ className }) =>
      lines([
        className,
        '  margin 10px',
        '  padding 8px',
        '',
        'rounded()',
        '  border-radius 8px',
      ]),
    ),
  ),
);

const postcssFixture = fixture(
  'postcss',
  fc.oneof(
    fc.record({
      color: colorWord,
    }).map(({ color }) =>
      lines([
        '@define-mixin button-base {',
        `  color: ${color};`,
        '}',
        '',
        '.button {',
        '  @apply px-4 py-2;',
        '}',
      ]),
    ),
    fc.record({
      className: lowerWord,
    }).map(({ className }) =>
      lines([
        '@custom-media --narrow-window (max-width: 30em);',
        '',
        `.${className} {`,
        '  @apply font-bold;',
        '}',
      ]),
    ),
  ),
);

const pugFixture = fixture(
  'pug',
  fc.oneof(
    fc.record({
      title: pascalName,
    }).map(({ title }) =>
      lines([
        'doctype html',
        'html',
        '  body',
        `    h1 ${title}`,
      ]),
    ),
    fc.record({
      className: lowerWord,
    }).map(({ className }) =>
      lines([
        `div.${className}`,
        '  each item in items',
        '    span= item',
      ]),
    ),
  ),
);

const protobufFixture = fixture(
  'protobuf',
  fc.oneof(
    fc.record({
      messageName: pascalName,
      fieldName: lowerWord,
    }).map(({ messageName, fieldName }) =>
      lines([
        'syntax = "proto3";',
        '',
        `message ${messageName} {`,
        `  string ${fieldName} = 1;`,
        '}',
      ]),
    ),
    fc.record({
      serviceName: pascalName,
      rpcName: pascalName,
    }).map(({ serviceName, rpcName }) =>
      lines([
        'syntax = "proto3";',
        '',
        `service ${serviceName} {`,
        `  rpc ${rpcName} (Request) returns (Response);`,
        '}',
      ]),
    ),
  ),
);

const groovyFixture = fixture(
  'groovy',
  fc.oneof(
    fc.record({
      taskName: camelName,
    }).map(({ taskName }) =>
      lines([
        `task ${taskName} {`,
        "  description = 'demo'",
        '  doLast {',
        '    println "done"',
        '  }',
        '}',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `def ${value} = items.collect { it.name }`,
        `println "${value}"`,
      ]),
    ),
  ),
);

const clojureFixture = fixture(
  'clojure',
  fc.oneof(
    fc.record({
      namespaceName: lowerWord,
      fnName: camelName,
    }).map(({ namespaceName, fnName }) =>
      lines([
        `(ns app.${namespaceName})`,
        '',
        `(defn ${fnName} [items]`,
        '  (map inc items))',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `(def ${value} {:name "demo" :count 1})`,
        `(->> [1 2 3]`,
        '     (map inc))',
      ]),
    ),
  ),
);

const cppFixture = fixture(
  'cpp',
  fc.oneof(
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        '#include <iostream>',
        '',
        `class ${className} {`,
        'public:',
        '  void run() { std::cout << "ok"; }',
        '};',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        '#include <vector>',
        '',
        `auto ${value} = std::vector<int>{1, 2, 3};`,
      ]),
    ),
  ),
);

const crystalFixture = fixture(
  'crystal',
  fc.oneof(
    fc.record({
      className: pascalName,
    }).map(({ className }) =>
      lines([
        'require "spec"',
        '',
        `class ${className}`,
        '  property title : String',
        'end',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `getter ${value} : String`,
        `puts ${value}.to_s`,
      ]),
    ),
  ),
);

const coffeescriptFixture = fixture(
  'coffeescript',
  fc.oneof(
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) => `${fnName} = (item) -> item.id`),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `task '${value}', ->`,
        `  console.log "${value}"`,
      ]),
    ),
  ),
);

const hamlFixture = fixture(
  'haml',
  fc.oneof(
    fc.record({
      className: lowerWord,
    }).map(({ className }) =>
      lines([
        `%div.${className}`,
        '  %span Hello',
      ]),
    ),
    fc.record({
      value: camelName,
    }).map(({ value }) =>
      lines([
        `= ${value}`,
        '%p body',
      ]),
    ),
  ),
);

const nginxFixture = fixture(
  'nginx',
  fc.oneof(
    fc.record({
      host: lowerWord,
      port: portNumber,
    }).map(({ host, port }) =>
      lines([
        'server {',
        `  listen ${port};`,
        `  server_name ${host}.example.com;`,
        '  location / {',
        '    proxy_pass http://app;',
        '  }',
        '}',
      ]),
    ),
    fc.record({
      path: lowerWord,
    }).map(({ path }) =>
      lines([
        'location /api {',
        `  root /srv/${path};`,
        '  try_files $uri $uri/ =404;',
        '}',
      ]),
    ),
  ),
);

const vimFixture = fixture(
  'viml',
  fc.oneof(
    fc.record({
      color: lowerWord,
    }).map(({ color }) =>
      lines([
        'set number',
        `colorscheme ${color}`,
        'syntax on',
      ]),
    ),
    fc.record({
      fnName: camelName,
    }).map(({ fnName }) =>
      lines([
        `function! ${fnName}()`,
        '  let g:value = 1',
        'endfunction',
      ]),
    ),
  ),
);

export const LANGUAGE_DETECTION_ACCURACY_SEED = 20260330;

export const languageDetectionAccuracyFixtures: readonly LanguageDetectionFixture[] = [
  javascriptFixture,
  typescriptFixture,
  pythonFixture,
  goFixture,
  rustFixture,
  javaFixture,
  csharpFixture,
  phpFixture,
  rubyFixture,
  bashFixture,
  sqlFixture,
  jsonFixture,
  yamlFixture,
  tomlFixture,
  htmlFixture,
  cssFixture,
  xmlFixture,
  graphqlFixture,
  dockerfileFixture,
  kotlinFixture,
  swiftFixture,
  luaFixture,
  powershellFixture,
  makefileFixture,
  dotenvFixture,
  terraformFixture,
  cmakeFixture,
  prismaFixture,
  markdownFixture,
  vueFixture,
  svelteFixture,
  astroFixture,
  mdxFixture,
  handlebarsFixture,
  liquidFixture,
  jinjaFixture,
  twigFixture,
  dartFixture,
  apacheFixture,
  elmFixture,
  fsharpFixture,
  gdscriptFixture,
  haskellFixture,
  juliaFixture,
  matlabFixture,
  nimFixture,
  ocamlFixture,
  perlFixture,
  prologFixture,
  rFixture,
  scalaFixture,
  zigFixture,
  solidityFixture,
  elixirFixture,
  erlangFixture,
  latexFixture,
  objectivecFixture,
  scssFixture,
  lessFixture,
  stylusFixture,
  postcssFixture,
  pugFixture,
  protobufFixture,
  groovyFixture,
  clojureFixture,
  cppFixture,
  crystalFixture,
  coffeescriptFixture,
  hamlFixture,
  nginxFixture,
  vimFixture,
];
