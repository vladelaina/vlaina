import { findTopLevelBoundary } from '../selectorList';

interface ConsumedRootSelector {
  rootSuffix: string;
  rest: string;
}

export const MARKDOWN_WRAPPER_ALIAS_PATTERN = new RegExp([
  String.raw`^(?:`,
  String.raw`content`,
  String.raw`|\.typora-export`,
  String.raw`|\.typora-export-content`,
  String.raw`|\.workspace-leaf-content`,
  String.raw`|\.view-content`,
  String.raw`|\.markdown-preview-sizer`,
  String.raw`|\.markdown-preview-pusher`,
  String.raw`|\.markdown-preview-spacer`,
  String.raw`)(?=$|[\s>+~):.#\[])`,
].join(''), 'i');

const ROOT_STATE_PATTERN = new RegExp([
  String.raw`^\.(`,
  String.raw`(?:is-(?:live-preview|phone|mobile|tablet|desktop|readable-line-width))`,
  String.raw`|ty-on-typewriter-mode|mod-cm5|max|wide`,
  String.raw`)(?=$|[\s.#:[>+~])`,
].join(''), 'i');

const STANDALONE_ROOT_STATE_PATTERN = new RegExp([
  String.raw`^\.(`,
  String.raw`(?:is-(?:live-preview|phone|mobile|tablet|desktop|readable-line-width))`,
  String.raw`|ty-on-typewriter-mode`,
  String.raw`)(?=$|[\s.#:[>+~])`,
].join(''), 'i');

const MARKDOWN_ROOT_ALIAS_PATTERN = new RegExp([
  String.raw`^(?:`,
  String.raw`#write`,
  String.raw`|\.markdown-preview-view`,
  String.raw`|\.markdown-rendered`,
  String.raw`|\.markdown-reading-view`,
  String.raw`|\.markdown-preview-section`,
  String.raw`|\.markdown-source-view`,
  String.raw`|\.cm-s-obsidian`,
  String.raw`|\.mod-cm6`,
  String.raw`)(?=$|[\s>+~):.#\[])`,
].join(''), 'i');

export function scopeLeadingRootSelector(selector: string, scopeSelector: string): string | null {
  const folded = foldLeadingRootSelector(selector);
  if (!folded) return null;
  if (!folded.remaining) return `${scopeSelector}${folded.rootSuffix}`;
  return `${scopeSelector}${folded.rootSuffix} ${folded.remaining}`;
}

export function foldNestedLeadingRootSelector(selector: string): string {
  const normalized = selector.trim();
  if (!normalized) return normalized;

  const folded = foldLeadingRootSelector(normalized);
  if (!folded) return normalized;
  if (!folded.remaining) return folded.rootSuffix || normalized;
  if (!folded.rootSuffix) return folded.remaining;
  return `${folded.rootSuffix} ${folded.remaining}`;
}

function foldLeadingRootSelector(selector: string): {
  rootSuffix: string;
  remaining: string;
} | null {
  let remaining = selector;
  let rootSuffix = '';
  let consumedRoot = false;

  while (remaining) {
    const consumed = consumeLeadingThemeState(remaining)
      ?? (consumedRoot ? consumeLeadingRootState(remaining) : consumeLeadingStandaloneRootState(remaining))
      ?? consumeLeadingDocumentRoot(remaining)
      ?? consumeLeadingMarkdownRootAlias(remaining);
    if (!consumed) break;

    rootSuffix += consumed.rootSuffix;
    consumedRoot = true;

    const nextRootCandidate = trimLeadingCombinator(consumed.rest);
    if (!nextRootCandidate) {
      remaining = '';
      break;
    }

    if (canConsumeLeadingRoot(nextRootCandidate)) {
      remaining = nextRootCandidate;
      continue;
    }

    remaining = formatRemainingDescendantSelector(consumed.rest);
    break;
  }

  if (!consumedRoot) return null;
  return { rootSuffix, remaining };
}

function canConsumeLeadingRoot(selector: string): boolean {
  return Boolean(
    consumeLeadingThemeState(selector)
      ?? consumeLeadingRootState(selector)
      ?? consumeLeadingDocumentRoot(selector)
      ?? consumeLeadingMarkdownRootAlias(selector)
  );
}

function consumeLeadingThemeState(selector: string): ConsumedRootSelector | null {
  const match = selector.match(/^\.theme-(?:dark|light)(?=$|[\s.#:[>+~])/i);
  if (!match) return null;

  return {
    rootSuffix: match[0],
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingRootState(selector: string): ConsumedRootSelector | null {
  const match = selector.match(ROOT_STATE_PATTERN);
  if (!match) return null;

  const rootState = match[1].toLowerCase() === 'mod-cm5' ? '.mod-cm6' : match[0];
  return {
    rootSuffix: rootState,
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingStandaloneRootState(selector: string): ConsumedRootSelector | null {
  const match = selector.match(STANDALONE_ROOT_STATE_PATTERN);
  if (!match) return null;

  return {
    rootSuffix: match[0],
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingDocumentRoot(selector: string): ConsumedRootSelector | null {
  const prefix = selector.match(/^(?:html|body|:root)(?=$|[\s>+~):.#\[])/i)?.[0];
  if (!prefix) return null;

  const boundary = findTopLevelBoundary(selector, prefix.length);
  const compound = boundary < 0 ? selector : selector.slice(0, boundary);
  const rootSuffix = normalizeDocumentRootSuffix(compound.slice(prefix.length));
  const rest = boundary < 0 ? '' : selector.slice(boundary);

  return {
    rootSuffix,
    rest,
  };
}

function normalizeDocumentRootSuffix(rootSuffix: string): string {
  return rootSuffix
    .replace(/\.(?:typora-export|typora-export-content)(?=$|[.#:[)])/gi, '')
    .replace(/:not\(\s*\[class\]\s*\)/gi, '');
}

function consumeLeadingMarkdownRootAlias(selector: string): ConsumedRootSelector | null {
  const rootAlias = selector.match(MARKDOWN_ROOT_ALIAS_PATTERN)?.[0];
  const wrapperAlias = rootAlias ? null : selector.match(MARKDOWN_WRAPPER_ALIAS_PATTERN)?.[0];
  const prefix = rootAlias ?? wrapperAlias;
  if (!prefix) return null;

  const boundary = findTopLevelBoundary(selector, prefix.length);
  const compound = boundary < 0 ? selector : selector.slice(0, boundary);
  const rest = boundary < 0 ? '' : selector.slice(boundary);

  return {
    rootSuffix: rootAlias ? normalizeMarkdownRootAliasSuffix(compound) : '',
    rest,
  };
}

function normalizeMarkdownRootAliasSuffix(rootSuffix: string): string {
  return rootSuffix.replace(/\.mod-cm5(?=$|[.#:[)])/gi, '.mod-cm6');
}

function trimLeadingCombinator(selector: string): string {
  return selector.replace(/^\s*(?:[>+~]\s*)?/, '').trim();
}

function formatRemainingDescendantSelector(selector: string): string {
  const trimmed = selector.trim();
  if (trimmed.startsWith('>')) {
    return trimmed;
  }
  if (trimmed.startsWith('+') || trimmed.startsWith('~')) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}
