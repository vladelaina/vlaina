import { GITHUB_DROP_WITH_CONTENT_TAGS } from './githubHtmlPolicy';

export interface GithubRawHtmlStripResult {
  activeTag: string | null;
  value: string;
}

interface RawHtmlTag {
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
}

const RAW_HTML_TAG_PATTERN = /^<\/?([A-Za-z][A-Za-z0-9:-]*)(?:\s|\/?>|$)/;

function findRawHtmlTagEnd(content: string, start: number): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
    const char = content[cursor];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return cursor + 1;
    }
  }

  return -1;
}

function parseRawHtmlTag(content: string, start: number): RawHtmlTag | null {
  const end = findRawHtmlTagEnd(content, start);
  if (end === -1) {
    return null;
  }

  const tag = content.slice(start, end);
  const match = RAW_HTML_TAG_PATTERN.exec(tag);
  const name = match?.[1]?.toLowerCase();
  if (!name) {
    return null;
  }

  return {
    closing: tag.startsWith('</'),
    end,
    name,
    selfClosing: /\/\s*>$/.test(tag),
  };
}

function findRawHtmlClosingTag(content: string, tagName: string, start: number): { end: number } | null {
  let cursor = start;
  while (cursor < content.length) {
    const nextTagStart = content.indexOf('<', cursor);
    if (nextTagStart === -1) {
      return null;
    }

    const nextTag = parseRawHtmlTag(content, nextTagStart);
    if (!nextTag) {
      cursor = nextTagStart + 1;
      continue;
    }

    if (nextTag.closing && nextTag.name === tagName) {
      return { end: nextTag.end };
    }

    cursor = nextTag.end;
  }

  return null;
}

function stripActiveDroppedTag(content: string, activeTag: string): GithubRawHtmlStripResult {
  if (activeTag === 'plaintext') {
    return { activeTag, value: '' };
  }

  const close = findRawHtmlClosingTag(content, activeTag, 0);
  if (!close) {
    return { activeTag, value: '' };
  }

  return stripGithubDroppedRawHtmlContentFragment(content.slice(close.end));
}

export function stripGithubDroppedRawHtmlContentFragment(
  content: string,
  activeTag: string | null = null,
): GithubRawHtmlStripResult {
  if (activeTag) {
    return stripActiveDroppedTag(content, activeTag);
  }

  let output = '';
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) {
      output += content.slice(cursor);
      break;
    }

    const tag = parseRawHtmlTag(content, start);
    if (!tag) {
      output += content.slice(cursor, start + 1);
      cursor = start + 1;
      continue;
    }

    if (!GITHUB_DROP_WITH_CONTENT_TAGS.has(tag.name)) {
      output += content.slice(cursor, tag.end);
      cursor = tag.end;
      continue;
    }

    output += content.slice(cursor, start);
    if (tag.closing || tag.selfClosing) {
      cursor = tag.end;
      continue;
    }
    if (tag.name === 'plaintext') {
      return { activeTag: tag.name, value: output };
    }

    const close = findRawHtmlClosingTag(content, tag.name, tag.end);
    if (!close) {
      return { activeTag: tag.name, value: output };
    }

    cursor = close.end;
  }

  return { activeTag: null, value: output };
}

export function stripGithubDroppedRawHtmlContent(content: string): string {
  return stripGithubDroppedRawHtmlContentFragment(content).value;
}
