import { consumeLeadingCalloutEmoji } from './calloutEmoji';
import {
  createMarkdownTextSourceMap,
  replaceMarkdownTextNodeWithSlice,
} from './markdownSourcePosition';
import {
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import type { MdastNode } from './remarkNotesTypes';

const MAX_CALLOUT_ICON_VALUE_CHARS = 2048;
const MAX_CALLOUT_ICON_MARKER_CHARS = 4096;
const CALLOUT_ICON_TEXT_PREFIX = '[!callout-icon:';
const CALLOUT_ICON_TEXT_SUFFIX = ']';
const CALLOUT_ICON_COMMENT_PREFIX = '<!--callout-icon:';
const CALLOUT_ICON_COMMENT_SUFFIX = '-->';

function iconDataFromCalloutValue(value: string | null | undefined) {
  return value && value.length <= MAX_CALLOUT_ICON_VALUE_CHARS ? value : '💡';
}

function normalizeDecodedCalloutIconValue(value: string): string | null {
  return value && value.length <= MAX_CALLOUT_ICON_VALUE_CHARS ? value : null;
}

function decodeCalloutIconMarkerValue(value: string): string | null {
  if (value.length > MAX_CALLOUT_ICON_MARKER_CHARS) {
    return null;
  }

  try {
    return normalizeDecodedCalloutIconValue(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function findBoundedCalloutIconTextSuffix(value: string, markerStart: number): number {
  const markerWindow = value.slice(
    markerStart,
    markerStart + MAX_CALLOUT_ICON_MARKER_CHARS + CALLOUT_ICON_TEXT_SUFFIX.length
  );
  const suffixOffset = markerWindow.indexOf(CALLOUT_ICON_TEXT_SUFFIX);
  return suffixOffset >= 0 ? markerStart + suffixOffset : -1;
}

function decodeCalloutIconComment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(CALLOUT_ICON_TEXT_PREFIX)) {
    const markerStart = CALLOUT_ICON_TEXT_PREFIX.length;
    const suffixIndex = findBoundedCalloutIconTextSuffix(trimmed, markerStart);
    if (suffixIndex > markerStart) {
      return decodeCalloutIconMarkerValue(trimmed.slice(markerStart, suffixIndex));
    }
  }

  if (!trimmed.startsWith(CALLOUT_ICON_COMMENT_PREFIX) || !trimmed.endsWith(CALLOUT_ICON_COMMENT_SUFFIX)) {
    return null;
  }

  return decodeCalloutIconMarkerValue(trimmed.slice(
    CALLOUT_ICON_COMMENT_PREFIX.length,
    -CALLOUT_ICON_COMMENT_SUFFIX.length
  ));
}

function getLeadingCalloutIconMarkerRestStart(value: string): number | null {
  const prefixIndex = value.search(/\S/u);
  if (prefixIndex < 0 || !value.startsWith(CALLOUT_ICON_TEXT_PREFIX, prefixIndex)) {
    return null;
  }

  const markerStart = prefixIndex + CALLOUT_ICON_TEXT_PREFIX.length;
  const suffixIndex = findBoundedCalloutIconTextSuffix(value, markerStart);
  if (suffixIndex <= markerStart) {
    return null;
  }

  const afterMarker = suffixIndex + CALLOUT_ICON_TEXT_SUFFIX.length;
  return afterMarker + (value.slice(afterMarker).match(/^\s*/u)?.[0].length ?? 0);
}

function getCalloutIconFromBlockquote(node: MdastNode): string | null {
  if (node.type !== 'blockquote') return null;

  const firstChild = node.children?.[0];
  const iconComment = firstChild?.type === 'html'
    ? decodeCalloutIconComment(firstChild.value || '')
    : null;
  if (iconComment) return iconComment;

  if (!firstChild || firstChild.type !== 'paragraph') return null;

  const text = firstChild.children?.[0];
  if (!text || text.type !== 'text') return null;

  const markerIcon = decodeCalloutIconComment(text.value || '');
  if (markerIcon) return markerIcon;

  return consumeLeadingCalloutEmoji(text.value || '')?.icon ?? null;
}

export function transformCalloutBlockquotes(
  tree: MdastNode,
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
) {
  const stack = [{ node: tree, visited: false }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const { node } = frame;
    if (!frame.visited) {
      stack.push({ node, visited: true });
      for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) {
        stack.push({ node: node.children![index], visited: false });
      }
      continue;
    }

    const icon = getCalloutIconFromBlockquote(node);
    if (!icon) continue;
    if (!growthBudget.consume(3)) continue;

    const children = node.children ? [...node.children] : [];
    const firstChild = children[0];
    if (firstChild?.type === 'html' && decodeCalloutIconComment(firstChild.value || '')) {
      children.shift();
    } else if (firstChild?.type === 'paragraph') {
      const firstText = firstChild.children?.[0];
      if (firstText?.type === 'text') {
        const markerIcon = decodeCalloutIconComment(firstText.value || '');
        const consumedEmoji = markerIcon ? null : consumeLeadingCalloutEmoji(firstText.value || '');
        const remainingTextStart = markerIcon
          ? getLeadingCalloutIconMarkerRestStart(firstText.value || '')
          : consumedEmoji
            ? (firstText.value || '').length - consumedEmoji.rest.length
            : null;
        if (remainingTextStart !== null && remainingTextStart < (firstText.value || '').length) {
          const sourceMap = typeof firstText.value === 'string' && firstText.value.length > 0
            ? createMarkdownTextSourceMap(firstText.value, markdown, firstText.position)
            : null;
          replaceMarkdownTextNodeWithSlice(firstText, sourceMap, remainingTextStart, firstText.value?.length ?? 0);
        } else if (remainingTextStart !== null) {
          firstChild.children?.shift();
        } else {
          firstChild.children?.shift();
        }
      }
    }

    node.type = 'container';
    node.children = [
      {
        type: 'container',
        data: { hName: 'div', hProperties: { className: ['callout-icon'] } },
        children: [{ type: 'text', value: iconDataFromCalloutValue(icon) }],
      },
      {
        type: 'container',
        data: { hName: 'div', hProperties: { className: ['callout-content'] } },
        children,
      },
    ];
    node.data = {
      hName: 'div',
      hProperties: {
        className: ['callout', 'callout-yellow'],
        dataType: 'callout',
      },
    };
  }
}
