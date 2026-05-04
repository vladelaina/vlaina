import { expect } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { configureTheme } from '../../theme';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from '../frontmatter/frontmatterMarkdown';
import { mathPlugin } from '../math';
import { calloutPlugin } from '../callout';
import { footnotePlugin } from '../footnote';
import { frontmatterPlugin } from '../frontmatter';
import { highlightPlugin } from '../highlight';
import { mermaidPlugin } from '../mermaid';
import { videoPlugin } from '../video';
import { tocPlugin } from '../toc';
import { blockAlignmentPlugin } from '../floating-toolbar';
import { colorMarksPlugin } from '../floating-toolbar/colorMarks';
import { codePlugin } from '../code';

const syntaxPlugins = [
  ...mathPlugin,
  ...calloutPlugin,
  ...footnotePlugin,
  ...frontmatterPlugin,
  ...highlightPlugin,
  ...mermaidPlugin,
  ...videoPlugin,
  ...tocPlugin,
  ...blockAlignmentPlugin,
  ...colorMarksPlugin,
  ...codePlugin,
];

interface EditorRoundTripSnapshot {
  docJson: unknown;
  persisted: string;
}

async function openMarkdownThroughSyntaxEditor(markdown: string): Promise<EditorRoundTripSnapshot> {
  const defaultValue = preserveMarkdownBlankLinesForEditor(
    normalizeLeadingFrontmatterMarkdown(normalizeSerializedMarkdownDocument(markdown))
  );
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  for (const plugin of syntaxPlugins) {
    editor.use(plugin);
  }

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const serialized = serializer(view.state.doc);
  const docJson = view.state.doc.toJSON();
  await editor.destroy();

  return {
    docJson,
    persisted: serializeLeadingFrontmatterMarkdown(
      normalizeSerializedMarkdownDocument(serialized),
      markdown
    ),
  };
}

export function collectDocText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { attrs?: unknown; text?: unknown; content?: unknown };
  const ownText = typeof node.text === 'string' ? node.text : '';
  const attrsText = collectAttrsText(node.attrs);
  const childText = Array.isArray(node.content)
    ? node.content.map(collectDocText).join('')
    : '';
  return ownText + attrsText + childText;
}

function collectAttrsText(attrs: unknown): string {
  if (!attrs || typeof attrs !== 'object') return '';
  return Object.entries(attrs as Record<string, unknown>)
    .filter(([key]) => key === 'alt' || key === 'title')
    .map(([, value]) => typeof value === 'string' ? value : '')
    .join('');
}

function expectPersistedMarkdownToBeClean(markdown: string): void {
  expect(markdown).not.toMatch(/data-vlaina-/);
  expect(markdown).not.toMatch(/date-vlaina-/);
  expect(markdown).not.toContain('\u200B');
  expect(markdown).not.toContain('\u200C');
  expect(markdown).not.toContain('VLAINA_LIST_GAP_SENTINEL');
}

export async function expectStableMarkdownRoundTrip(
  markdown: string,
  expected = markdown,
  expectedText?: string,
): Promise<void> {
  const firstOpen = await openMarkdownThroughSyntaxEditor(markdown);
  const firstPersisted = stripTrailingNewlines(firstOpen.persisted);
  expectPersistedMarkdownToBeClean(firstPersisted);
  expect(firstPersisted).toBe(expected);
  if (expectedText) {
    expect(collectDocText(firstOpen.docJson)).toContain(expectedText);
  }

  const secondOpen = await openMarkdownThroughSyntaxEditor(firstPersisted);
  const secondPersisted = stripTrailingNewlines(secondOpen.persisted);
  expectPersistedMarkdownToBeClean(secondPersisted);
  expect(secondOpen.docJson).toEqual(firstOpen.docJson);
  expect(secondPersisted).toBe(firstPersisted);
}
