import {
  GITHUB_DROP_WITH_CONTENT_TAGS,
  GITHUB_GFM_DISALLOWED_RAW_HTML_TAGS,
  GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS,
} from './githubHtmlPolicy';

export interface GithubRawHtmlStripResult {
  activeDepth: number;
  activeTag: string | null;
  mode: 'drop' | 'escape' | null;
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

function scanRawHtmlContainer(
  content: string,
  tagName: string,
  start: number,
  initialDepth: number,
): { closeEnd: number | null; depth: number } {
  let cursor = start;
  let depth = Math.max(1, initialDepth);
  while (cursor < content.length) {
    const nextTagStart = content.indexOf('<', cursor);
    if (nextTagStart === -1) {
      return { closeEnd: null, depth };
    }

    const nextTag = parseRawHtmlTag(content, nextTagStart);
    if (!nextTag) {
      cursor = nextTagStart + 1;
      continue;
    }

    if (nextTag.name === tagName) {
      if (nextTag.closing) {
        depth -= 1;
        if (depth <= 0) {
          return { closeEnd: nextTag.end, depth: 0 };
        }
      } else if (!nextTag.selfClosing) {
        depth += 1;
      }
    }

    cursor = nextTag.end;
  }

  return { closeEnd: null, depth };
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripActiveDroppedTag(
  content: string,
  activeTag: string,
  tags: ReadonlySet<string>,
  activeDepth = 1,
): GithubRawHtmlStripResult {
  if (activeTag === 'plaintext') {
    return { activeDepth, activeTag, mode: 'drop', value: '' };
  }

  const close = scanRawHtmlContainer(content, activeTag, 0, activeDepth);
  if (close.closeEnd === null) {
    return { activeDepth: close.depth, activeTag, mode: 'drop', value: '' };
  }

  return stripGithubDroppedRawHtmlContentFragment(content.slice(close.closeEnd), null, tags);
}

function escapeActiveRawHtmlTag(
  content: string,
  activeTag: string,
  dropTags: ReadonlySet<string>,
  escapeTags: ReadonlySet<string>,
  activeDepth = 1,
): GithubRawHtmlStripResult {
  if (activeTag === 'plaintext') {
    return { activeDepth, activeTag, mode: 'escape', value: escapeHtmlText(content) };
  }

  const close = scanRawHtmlContainer(content, activeTag, 0, activeDepth);
  if (close.closeEnd === null) {
    return { activeDepth: close.depth, activeTag, mode: 'escape', value: escapeHtmlText(content) };
  }

  const next = prepareGithubRawHtmlForMarkdownSanitizerFragment(
    content.slice(close.closeEnd),
    null,
    null,
    { dropTags, escapeTags },
  );
  return {
    activeDepth: next.activeDepth,
    activeTag: next.activeTag,
    mode: next.mode,
    value: `${escapeHtmlText(content.slice(0, close.closeEnd))}${next.value}`,
  };
}

export function stripGithubDroppedRawHtmlContentFragment(
  content: string,
  activeTag: string | null = null,
  tags: ReadonlySet<string> = GITHUB_DROP_WITH_CONTENT_TAGS,
  activeDepth = 1,
): GithubRawHtmlStripResult {
  if (activeTag) {
    return stripActiveDroppedTag(content, activeTag, tags, activeDepth);
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

    if (!tags.has(tag.name)) {
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
      return { activeDepth: 1, activeTag: tag.name, mode: 'drop', value: output };
    }

    const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
    if (close.closeEnd === null) {
      return { activeDepth: close.depth, activeTag: tag.name, mode: 'drop', value: output };
    }

    cursor = close.closeEnd;
  }

  return { activeDepth: 0, activeTag: null, mode: null, value: output };
}

export function stripGithubDroppedRawHtmlContent(content: string): string {
  return stripGithubDroppedRawHtmlContentFragment(content).value;
}

export function prepareGithubRawHtmlForMarkdownSanitizerFragment(
  content: string,
  activeTag: string | null = null,
  activeMode: 'drop' | 'escape' | null = null,
  options: {
    activeDepth?: number
    dropTags?: ReadonlySet<string>
    escapeTags?: ReadonlySet<string>
  } = {},
): GithubRawHtmlStripResult {
  const dropTags = options.dropTags ?? GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS;
  const escapeTags = options.escapeTags ?? GITHUB_GFM_DISALLOWED_RAW_HTML_TAGS;
  const activeDepth = options.activeDepth ?? 1;

  if (activeTag && activeMode === 'drop') {
    return stripActiveDroppedTag(content, activeTag, dropTags, activeDepth);
  }
  if (activeTag && activeMode === 'escape') {
    return escapeActiveRawHtmlTag(content, activeTag, dropTags, escapeTags, activeDepth);
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

    if (!dropTags.has(tag.name) && !escapeTags.has(tag.name)) {
      output += content.slice(cursor, tag.end);
      cursor = tag.end;
      continue;
    }

    output += content.slice(cursor, start);
    if (dropTags.has(tag.name)) {
      if (tag.closing || tag.selfClosing) {
        cursor = tag.end;
        continue;
      }

      const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
      if (close.closeEnd === null) {
        return { activeDepth: close.depth, activeTag: tag.name, mode: 'drop', value: output };
      }

      cursor = close.closeEnd;
      continue;
    }

    if (tag.closing || tag.selfClosing) {
      output += escapeHtmlText(content.slice(start, tag.end));
      cursor = tag.end;
      continue;
    }
    if (tag.name === 'plaintext') {
      return {
        activeDepth: 1,
        activeTag: tag.name,
        mode: 'escape',
        value: `${output}${escapeHtmlText(content.slice(start))}`,
      };
    }

    const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
    if (close.closeEnd === null) {
      return {
        activeDepth: close.depth,
        activeTag: tag.name,
        mode: 'escape',
        value: `${output}${escapeHtmlText(content.slice(start))}`,
      };
    }

    output += escapeHtmlText(content.slice(start, close.closeEnd));
    cursor = close.closeEnd;
  }

  return { activeDepth: 0, activeTag: null, mode: null, value: output };
}

export function prepareGithubRawHtmlForMarkdownSanitizer(content: string): string {
  return prepareGithubRawHtmlForMarkdownSanitizerFragment(content).value;
}
