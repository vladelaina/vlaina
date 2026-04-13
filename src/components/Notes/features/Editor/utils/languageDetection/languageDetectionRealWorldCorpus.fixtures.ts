export interface LanguageDetectionRealWorldCase {
  name: string;
  expected: string | null;
  sample: string;
}

export const languageDetectionRealWorldCorpus: readonly LanguageDetectionRealWorldCase[] = [
  {
    name: 'javascript react fetch handler',
    expected: 'javascript',
    sample: `const onSubmit = async () => {
  const response = await fetch('/api/notes');
  return response.json();
};`,
  },
  {
    name: 'typescript generic api response',
    expected: 'typescript',
    sample: `type ApiResponse<T> = {
  data: T;
  error?: string;
};`,
  },
  {
    name: 'python small utility',
    expected: 'python',
    sample: `def slugify(value: str) -> str:
    return value.strip().lower().replace(" ", "-")`,
  },
  {
    name: 'go error handling',
    expected: 'go',
    sample: `user, err := repo.Load(ctx, id)
if err != nil {
    return err
}`,
  },
  {
    name: 'rust option handling',
    expected: 'rust',
    sample: `fn render(value: Option<String>) -> String {
    value.unwrap_or_default()
}`,
  },
  {
    name: 'java simple main',
    expected: 'java',
    sample: `public class Main {
    public static void main(String[] args) {
        System.out.println("hello");
    }
}`,
  },
  {
    name: 'csharp linq style method',
    expected: 'csharp',
    sample: `public record Note(string Title);
var active = notes.Where(note => note.Title != string.Empty);`,
  },
  {
    name: 'php template response',
    expected: 'php',
    sample: `<?php
$title = "hello";
echo $title;`,
  },
  {
    name: 'ruby rails scope',
    expected: 'ruby',
    sample: `class Note < ApplicationRecord
  scope :recent, -> { order(created_at: :desc) }
end`,
  },
  {
    name: 'bash loop',
    expected: 'bash',
    sample: `for file in ./src/*.ts; do
  echo "$file"
done`,
  },
  {
    name: 'sql query',
    expected: 'sql',
    sample: `select id, title
from notes
where archived = false
order by updated_at desc;`,
  },
  {
    name: 'c stdio add function',
    expected: 'c',
    sample: `#include <stdio.h>

int add(int a, int b);

int main(void) {
  int x = 1;
  int y = 2;
  printf("sum = %d\n", add(x, y));
  return 0;
}

int add(int a, int b) {
  return a + b;
}`,
  },
  {
    name: 'json payload',
    expected: 'json',
    sample: `{
  "title": "Weekly Review",
  "done": false
}`,
  },
  {
    name: 'yaml compose fragment',
    expected: 'yaml',
    sample: `services:
  app:
    image: node:20
    ports:
      - "3000:3000"`,
  },
  {
    name: 'toml package section',
    expected: 'toml',
    sample: `[package]
name = "vlaina"
version = "0.1.0"`,
  },
  {
    name: 'html section with button',
    expected: 'html',
    sample: `<section class="hero">
  <button data-role="save">Save</button>
</section>`,
  },
  {
    name: 'css utility block',
    expected: 'css',
    sample: `.editor-shell {
  display: grid;
  gap: 12px;
}`,
  },
  {
    name: 'xml feed entry',
    expected: 'xml',
    sample: `<feed>
  <entry>hello</entry>
</feed>`,
  },
  {
    name: 'graphql query',
    expected: 'graphql',
    sample: `query NoteById($id: ID!) {
  note(id: $id) { id title }
}`,
  },
  {
    name: 'dockerfile build',
    expected: 'dockerfile',
    sample: `FROM node:20-alpine
WORKDIR /app
RUN pnpm install`,
  },
  {
    name: 'kotlin data class',
    expected: 'kotlin',
    sample: `data class NoteSummary(
  val title: String,
  val pinned: Boolean,
)`,
  },
  {
    name: 'swift ui state',
    expected: 'swift',
    sample: `import SwiftUI
@State private var title = ""`,
  },
  {
    name: 'lua local table concat',
    expected: 'lua',
    sample: `local value = table.concat(items, ",")
print(value)`,
  },
  {
    name: 'powershell param get item',
    expected: 'powershell',
    sample: `param([string]$Path)
$item = Get-Item -Path $Path`,
  },
  {
    name: 'makefile target',
    expected: 'makefile',
    sample: `.PHONY: test
test:
\tpnpm exec vitest run`,
  },
  {
    name: 'dotenv settings',
    expected: 'dotenv',
    sample: `APP_URL=https://app.example.com
DATABASE_URL=postgres://localhost:5432/app`,
  },
  {
    name: 'terraform resource',
    expected: 'terraform',
    sample: `resource "aws_s3_bucket" "assets" {
  bucket = "vlaina-assets"
}`,
  },
  {
    name: 'cmake add executable',
    expected: 'cmake',
    sample: `cmake_minimum_required(VERSION 3.20)
add_executable(app main.cpp)`,
  },
  {
    name: 'prisma model',
    expected: 'prisma',
    sample: `model Note {
  id Int @id @default(autoincrement())
  title String
}`,
  },
  {
    name: 'markdown fenced ts block',
    expected: 'markdown',
    sample: `# Demo

\`\`\`ts
const value = 1;
\`\`\``,
  },
  {
    name: 'vue single file component',
    expected: 'vue',
    sample: `<template>
  <button @click="count++">{{ count }}</button>
</template>
<script setup>
const count = ref(0)
</script>`,
  },
  {
    name: 'svelte reactive declaration',
    expected: 'svelte',
    sample: `<script>
  let count = 0;
  $: doubled = count * 2;
</script>`,
  },
  {
    name: 'astro frontmatter component',
    expected: 'astro',
    sample: `---
const title = Astro.props.title;
---
<h1>{title}</h1>`,
  },
  {
    name: 'mdx imported component',
    expected: 'mdx',
    sample: `import { Demo } from './components'

# Title

<Demo />`,
  },
  {
    name: 'handlebars block',
    expected: 'handlebars',
    sample: `{{#if user}}
  <p>{{user.name}}</p>
{{/if}}`,
  },
  {
    name: 'liquid product title',
    expected: 'liquid',
    sample: `{% assign heading = product.title %}
{{ heading | upcase | escape }}`,
  },
  {
    name: 'jinja extends block',
    expected: 'jinja',
    sample: `{% extends "base.html" %}
{% block content %}
  {{ title|safe }}
{% endblock %}`,
  },
  {
    name: 'twig merge encode',
    expected: 'twig',
    sample: `{% set payload = items|merge(extra) %}
{{ payload|json_encode }}`,
  },
  {
    name: 'dart flutter widget',
    expected: 'dart',
    sample: `import 'package:flutter/material.dart';
class Demo extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const Text("hi");
}`,
  },
  {
    name: 'scala case class',
    expected: 'scala',
    sample: `case class User(name: String)
val active = users.filter(_.enabled)`,
  },
  {
    name: 'zig pub fn',
    expected: 'zig',
    sample: `pub fn main() i32 {
    return 1;
}`,
  },
  {
    name: 'solidity contract',
    expected: 'solidity',
    sample: `pragma solidity ^0.8.20;
contract Vault {
  mapping(address => uint256) public balances;
}`,
  },
  {
    name: 'elixir pipeline',
    expected: 'elixir',
    sample: `defmodule Demo do
  def run(value) do
    value |> String.trim()
  end
end`,
  },
  {
    name: 'erlang module export',
    expected: 'erlang',
    sample: `-module(demo).
-export([start/0]).
start() -> ok.`,
  },
  {
    name: 'latex equation',
    expected: 'latex',
    sample: `\\begin{equation}
E = mc^2
\\end{equation}`,
  },
  {
    name: 'objective c interface',
    expected: 'objectivec',
    sample: `#import <Foundation/Foundation.h>
@interface Demo : NSObject
@end`,
  },
  {
    name: 'scss mixin',
    expected: 'scss',
    sample: `$primary-color: #1d4ed8;
@mixin button-base {
  color: $primary-color;
}`,
  },
  {
    name: 'less variable',
    expected: 'less',
    sample: `@primary: #1d4ed8;
.button {
  color: @primary;
}`,
  },
  {
    name: 'stylus indentation',
    expected: 'stylus',
    sample: `primary = #1d4ed8
button
  color primary`,
  },
  {
    name: 'postcss apply',
    expected: 'postcss',
    sample: `@define-mixin button-base {
  color: #1d4ed8;
}
.button {
  @apply px-4 py-2;
}`,
  },
  {
    name: 'pug nested markup',
    expected: 'pug',
    sample: `section.hero
  h1 Title
  button Save`,
  },
  {
    name: 'protobuf syntax',
    expected: 'protobuf',
    sample: `syntax = "proto3";
message Note {
  string title = 1;
}`,
  },
  {
    name: 'groovy gradle task',
    expected: 'groovy',
    sample: `task buildApp {
  doLast {
    println "done"
  }
}`,
  },
  {
    name: 'clojure namespace',
    expected: 'clojure',
    sample: `(ns notes.core)
(defn render [value] (str value))`,
  },
  {
    name: 'cpp vector include',
    expected: 'cpp',
    sample: `#include <vector>
auto items = std::vector<int>{1, 2, 3};`,
  },
  {
    name: 'crystal property',
    expected: 'crystal',
    sample: `class Note
  property title : String
end`,
  },
  {
    name: 'coffeescript fat arrow',
    expected: 'coffeescript',
    sample: `render = (items) ->
  items.map (item) -> item.title`,
  },
  {
    name: 'haml structure',
    expected: 'haml',
    sample: `%section.hero
  %h1 Title
  %p body`,
  },
  {
    name: 'nginx server block',
    expected: 'nginx',
    sample: `server {
  listen 80;
  server_name app.example.com;
}`,
  },
  {
    name: 'viml settings',
    expected: 'viml',
    sample: `set number
colorscheme nord`,
  },
  {
    name: 'apache virtual host',
    expected: 'apache',
    sample: `<VirtualHost *:80>
  ServerName app.example.com
  DocumentRoot "/var/www/app"
</VirtualHost>`,
  },
  {
    name: 'elm module exposing',
    expected: 'elm',
    sample: `module Main exposing (main)
import Html exposing (text)
main = text "hello"`,
  },
  {
    name: 'fsharp pipeline',
    expected: 'fsharp',
    sample: `let numbers = [1..5] |> List.filter (fun value -> value > 2)
printfn "%A" numbers`,
  },
  {
    name: 'gdscript node ready',
    expected: 'gdscript',
    sample: `extends Node
func _ready():
    print("ready")`,
  },
  {
    name: 'haskell io main',
    expected: 'haskell',
    sample: `main :: IO ()
main = print [x ^ 2 | x <- [1..5]]`,
  },
  {
    name: 'julia comprehension',
    expected: 'julia',
    sample: `values = [x^2 for x in 1:10]
println(values)`,
  },
  {
    name: 'matlab matrix size',
    expected: 'matlab',
    sample: `A = [1 2 3; 4 5 6];
disp(size(A));`,
  },
  {
    name: 'nim proc',
    expected: 'nim',
    sample: `proc render(value: string): string =
  result = value.strip()`,
  },
  {
    name: 'ocaml recursive function',
    expected: 'ocaml',
    sample: `let rec sum value =
  if value <= 0 then 0 else value + sum (value - 1)`,
  },
  {
    name: 'perl strict print',
    expected: 'perl',
    sample: `use strict;
my $value = "hello";
print $value;`,
  },
  {
    name: 'prolog dynamic fact',
    expected: 'prolog',
    sample: `:- dynamic parent/2.
parent(alice, bob).
ancestor(X, Y) :- parent(X, Y).`,
  },
  {
    name: 'r dplyr frame',
    expected: 'r',
    sample: `library(dplyr)
data <- data.frame(value = c(1, 2, 3))
summary(data)`,
  },
  {
    name: 'plain user note should reject',
    expected: null,
    sample: `Meeting summary:
ship the editor update tomorrow
follow up with design after lunch`,
  },
  {
    name: 'stack trace should reject',
    expected: null,
    sample: `Error: failed to load workspace
    at render (App.tsx:42:13)
    at async main (index.ts:7:3)`,
  },
];
