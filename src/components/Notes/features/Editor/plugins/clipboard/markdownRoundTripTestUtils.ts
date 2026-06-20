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
  normalizeAlternativeMathBlockFences,
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  restoreMathBlockFenceStylesFromReference,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from '../frontmatter/frontmatterMarkdown';
import { expectPersistedMarkdownToBeClean } from './persistedMarkdownAssertions';
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
import { tablePlugin } from '../table';
import { abbrPlugin } from '../abbr';
import { deflistPlugin } from '../deflist';
import { autolinkPlugin } from '../links/autolink/autolinkPlugin';
import { markdownLinkPlugin } from '../links/markdown-link/markdownLinkPlugin';

const syntaxPlugins = [
  ...mathPlugin,
  ...calloutPlugin,
  ...footnotePlugin,
  ...frontmatterPlugin,
  ...highlightPlugin,
  ...tablePlugin,
  ...mermaidPlugin,
  ...videoPlugin,
  ...tocPlugin,
  ...blockAlignmentPlugin,
  ...colorMarksPlugin,
  ...codePlugin,
  ...abbrPlugin,
  ...deflistPlugin,
  autolinkPlugin,
  markdownLinkPlugin,
];

interface EditorRoundTripSnapshot {
  docJson: unknown;
  persisted: string;
}

async function openMarkdownThroughSyntaxEditor(markdown: string): Promise<EditorRoundTripSnapshot> {
  const defaultValue = preserveMarkdownBlankLinesForEditor(
    normalizeLeadingFrontmatterMarkdown(
      normalizeAlternativeMathBlockFences(markdown)
    )
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
  const normalized = normalizeSerializedMarkdownDocument(serialized);

  return {
    docJson,
    persisted: serializeLeadingFrontmatterMarkdown(
      restoreMathBlockFenceStylesFromReference(
        normalized,
        markdown
      ),
      markdown
    ),
  };
}

export function collectDocText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { attrs?: unknown; text?: unknown; type?: unknown; content?: unknown };
  const ownText = typeof node.text === 'string' ? node.text : '';
  const attrsText = collectAttrsText(node.attrs, node.type);
  const childText = Array.isArray(node.content)
    ? node.content.map(collectDocText).join('')
    : '';
  return ownText + attrsText + childText;
}

function collectAttrsText(attrs: unknown, nodeType: unknown): string {
  if (!attrs || typeof attrs !== 'object') return '';
  const record = attrs as Record<string, unknown>;
  const namedText = Object.entries(record)
    .filter(([key]) => key === 'alt' || key === 'title')
    .map(([, value]) => typeof value === 'string' ? value : '')
    .join('');
  const htmlText = (nodeType === 'html' || nodeType === 'html_block') && typeof record.value === 'string'
    ? extractHtmlText(record.value)
    : '';
  return namedText + htmlText;
}

function extractHtmlText(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}

export async function expectStableMarkdownRoundTrip(
  markdown: string,
  expected = markdown,
  expectedText?: string,
): Promise<void> {
  const firstOpen = await openMarkdownThroughSyntaxEditor(markdown);
  const firstPersisted = stripTrailingNewlines(firstOpen.persisted);
  const normalizedInput = stripTrailingNewlines(markdown);
  expectPersistedMarkdownToBeClean(firstPersisted);
  expect(firstPersisted).toBe(expected);
  if (expectedText) {
    expect(collectDocText(firstOpen.docJson)).toContain(expectedText);
  }

  const secondOpen = await openMarkdownThroughSyntaxEditor(firstPersisted);
  const secondPersisted = stripTrailingNewlines(secondOpen.persisted);
  expectPersistedMarkdownToBeClean(secondPersisted);
  expect(secondPersisted).toBe(firstPersisted);

  if (firstPersisted === normalizedInput) {
    expect(secondOpen.docJson).toEqual(firstOpen.docJson);
    return;
  }

  const thirdOpen = await openMarkdownThroughSyntaxEditor(secondPersisted);
  const thirdPersisted = stripTrailingNewlines(thirdOpen.persisted);
  expectPersistedMarkdownToBeClean(thirdPersisted);
  expect(thirdPersisted).toBe(secondPersisted);
  expect(thirdOpen.docJson).toEqual(secondOpen.docJson);
}

export async function expectConvergentPersistedMarkdownRoundTrip(
  markdown: string,
  expectedFirstPersisted = markdown,
  expectedText?: string,
): Promise<void> {
  const firstOpen = await openMarkdownThroughSyntaxEditor(markdown);
  const firstPersisted = stripTrailingNewlines(firstOpen.persisted);
  expectPersistedMarkdownToBeClean(firstPersisted);
  expect(firstPersisted).toBe(expectedFirstPersisted);
  if (expectedText) {
    expect(collectDocText(firstOpen.docJson)).toContain(expectedText);
  }

  const secondOpen = await openMarkdownThroughSyntaxEditor(firstPersisted);
  const secondPersisted = stripTrailingNewlines(secondOpen.persisted);
  expectPersistedMarkdownToBeClean(secondPersisted);

  const thirdOpen = await openMarkdownThroughSyntaxEditor(secondPersisted);
  const thirdPersisted = stripTrailingNewlines(thirdOpen.persisted);
  expectPersistedMarkdownToBeClean(thirdPersisted);
  expect(thirdPersisted).toBe(secondPersisted);
}
