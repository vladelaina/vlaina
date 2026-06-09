import {
  GITHUB_DROP_WITH_CONTENT_TAGS,
  GITHUB_GFM_DISALLOWED_RAW_HTML_TAGS,
  GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS,
} from './githubHtmlPolicy';
import { findRawHtmlNonTagEnd, parseRawHtmlTag, scanRawHtmlContainer } from './githubRawHtmlScanner';

export interface GithubRawHtmlStripResult {
  activeDepth: number;
  activeTag: string | null;
  mode: 'drop' | 'escape' | null;
  value: string;
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

  const output: string[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) {
      output.push(content.slice(cursor));
      break;
    }

    const tag = parseRawHtmlTag(content, start);
    if (!tag) {
      const nonTagEnd = findRawHtmlNonTagEnd(content, start);
      const nextCursor = nonTagEnd ?? start + 1;
      output.push(content.slice(cursor, nextCursor));
      cursor = nextCursor;
      continue;
    }

    if (!tags.has(tag.name)) {
      output.push(content.slice(cursor, tag.end));
      cursor = tag.end;
      continue;
    }

    output.push(content.slice(cursor, start));
    if (tag.closing || tag.selfClosing) {
      cursor = tag.end;
      continue;
    }
    if (tag.name === 'plaintext') {
      return { activeDepth: 1, activeTag: tag.name, mode: 'drop', value: output.join('') };
    }

    const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
    if (close.closeEnd === null) {
      return { activeDepth: close.depth, activeTag: tag.name, mode: 'drop', value: output.join('') };
    }

    cursor = close.closeEnd;
  }

  return { activeDepth: 0, activeTag: null, mode: null, value: output.join('') };
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

  const output: string[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) {
      output.push(content.slice(cursor));
      break;
    }

    const tag = parseRawHtmlTag(content, start);
    if (!tag) {
      const nonTagEnd = findRawHtmlNonTagEnd(content, start);
      const nextCursor = nonTagEnd ?? start + 1;
      output.push(content.slice(cursor, nextCursor));
      cursor = nextCursor;
      continue;
    }

    if (!dropTags.has(tag.name) && !escapeTags.has(tag.name)) {
      output.push(content.slice(cursor, tag.end));
      cursor = tag.end;
      continue;
    }

    output.push(content.slice(cursor, start));
    if (dropTags.has(tag.name)) {
      if (tag.closing || tag.selfClosing) {
        cursor = tag.end;
        continue;
      }

      const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
      if (close.closeEnd === null) {
        return { activeDepth: close.depth, activeTag: tag.name, mode: 'drop', value: output.join('') };
      }

      cursor = close.closeEnd;
      continue;
    }

    if (tag.closing || tag.selfClosing) {
      output.push(escapeHtmlText(content.slice(start, tag.end)));
      cursor = tag.end;
      continue;
    }
    if (tag.name === 'plaintext') {
      return {
        activeDepth: 1,
        activeTag: tag.name,
        mode: 'escape',
        value: `${output.join('')}${escapeHtmlText(content.slice(start))}`,
      };
    }

    const close = scanRawHtmlContainer(content, tag.name, tag.end, 1);
    if (close.closeEnd === null) {
      return {
        activeDepth: close.depth,
        activeTag: tag.name,
        mode: 'escape',
        value: `${output.join('')}${escapeHtmlText(content.slice(start))}`,
      };
    }

    output.push(escapeHtmlText(content.slice(start, close.closeEnd)));
    cursor = close.closeEnd;
  }

  return { activeDepth: 0, activeTag: null, mode: null, value: output.join('') };
}

export function prepareGithubRawHtmlForMarkdownSanitizer(content: string): string {
  return prepareGithubRawHtmlForMarkdownSanitizerFragment(content).value;
}
