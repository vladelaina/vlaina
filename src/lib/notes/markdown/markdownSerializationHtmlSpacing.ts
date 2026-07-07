import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN,
  GENERIC_HTML_BLOCK_TAGS,
  GenericHtmlSpacingFenceState,
  MarkdownFenceLine,
  RAW_HTML_BLOCK_OPEN_LINE_PATTERN
} from './markdownSerializationShared';

export function normalizeGenericHtmlBlockClosingSpacing(text: string): string {
  if (!text.includes('</')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment) => normalizeGenericHtmlBlockClosingSpacingSegment(segment),
    { protectHtmlBlocks: false },
  );
}

export function normalizeGenericHtmlBlockClosingSpacingSegment(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let activeFence: GenericHtmlSpacingFenceState | null = null;
  let activeGenericTagName: string | null = null;
  let activeRawTagName: string | null = null;

  for (const line of lines) {
    const content = getMarkdownBlockContent(line);

    if (activeFence) {
      output.push(line);
      if (isGenericHtmlSpacingFenceClose(content, activeFence)) {
        activeFence = null;
      }
      continue;
    }

    if (activeRawTagName) {
      output.push(line);
      if (new RegExp(`</${activeRawTagName}(?:\\s[^>]*)?>`, 'i').test(content)) {
        activeRawTagName = null;
      }
      continue;
    }

    if (activeGenericTagName) {
      const closePattern = new RegExp(`^(?: {0,3})<\\/${activeGenericTagName}\\s*>\\s*$`, 'i');
      const isCloseLine = closePattern.test(content);
      if (isCloseLine && output[output.length - 1] === '') {
        output.pop();
      }
      output.push(line);
      if (isCloseLine) {
        activeGenericTagName = null;
      }
      continue;
    }

    output.push(line);

    activeFence = getGenericHtmlSpacingFenceOpen(content);
    if (activeFence) {
      continue;
    }

    const rawTagName = RAW_HTML_BLOCK_OPEN_LINE_PATTERN.exec(content)?.[1]?.toLowerCase();
    if (rawTagName && !new RegExp(`</${rawTagName}(?:\\s[^>]*)?>`, 'i').test(content)) {
      activeRawTagName = rawTagName;
      continue;
    }

    const openTagName = GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN.exec(content)?.[1]?.toLowerCase();
    if (
      openTagName &&
      GENERIC_HTML_BLOCK_TAGS.has(openTagName) &&
      !/\/>\s*$/.test(content)
    ) {
      activeGenericTagName = openTagName;
    }
  }

  return output.join('\n');
}

export function getGenericHtmlSpacingFenceOpen(content: string): GenericHtmlSpacingFenceState | null {
  const fence = parseGenericHtmlSpacingFenceLine(content);
  if (!fence) return null;
  if (fence.marker === '`' && content.indexOf('`', fence.infoStart) !== -1) return null;
  return { marker: fence.marker, length: fence.length };
}

export function isGenericHtmlSpacingFenceClose(
  content: string,
  activeFence: GenericHtmlSpacingFenceState,
): boolean {
  const fence = parseGenericHtmlSpacingFenceLine(content);
  return Boolean(
    fence &&
    fence.marker === activeFence.marker &&
    fence.length >= activeFence.length &&
    content.slice(fence.infoStart).trim() === ''
  );
}

export function parseGenericHtmlSpacingFenceLine(content: string): MarkdownFenceLine | null {
  let index = 0;
  while (index < content.length && index <= 3 && content[index] === ' ') {
    index += 1;
  }
  if (index > 3) return null;

  const marker = content[index];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (content[index + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return {
    infoStart: index + length,
    length,
    marker,
  };
}
