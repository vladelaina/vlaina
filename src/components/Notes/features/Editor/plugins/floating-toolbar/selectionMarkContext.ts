import type { EditorView } from '@milkdown/kit/prose/view';
import { BARE_DOMAIN_HREF_PATTERN } from '../links/utils/constants';
import {
  MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES,
  MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS,
  NO_COMMON_VALUE,
} from './selectionHelperConstants';
import { forEachSelectedTextNode } from './selectionTraversal';
import type { TextRange } from './selectionHelperTypes';

export function getActiveMarks(view: EditorView): Set<string> {
  let activeMarks: Set<string> | null = null;

  const hasSelectedText = forEachSelectedTextNode(view, ({ node }) => {
    const nodeMarks = new Set(node.marks.map((mark) => mark.type.name));

    if (activeMarks === null) {
      activeMarks = nodeMarks;
      return;
    }

    activeMarks.forEach((markName) => {
      if (!nodeMarks.has(markName)) {
        activeMarks?.delete(markName);
      }
    });
  }, { excludeRestrictedParents: true });

  if (!hasSelectedText || activeMarks === null) {
    return new Set<string>();
  }

  return activeMarks;
}

export function getLinkUrl(view: EditorView): string | null {
  const linkUrl = getCommonMarkAttributeForFormattableText(view, 'link', 'href');
  if (linkUrl === null) {
    return null;
  }

  const selectedText = getSelectedFormattableText(view)?.trim();
  if (selectedText === undefined) {
    return null;
  }
  if (isPlainUrlLinkSelection(selectedText, linkUrl)) {
    return null;
  }

  return linkUrl;
}

export function getTextColor(view: EditorView): string | null {
  return getCommonMarkAttributeForFormattableText(view, 'textColor', 'color');
}

export function getBgColor(view: EditorView): string | null {
  return getCommonMarkAttributeForFormattableText(view, 'bgColor', 'color');
}

function getCommonMarkAttributeForFormattableText(
  view: EditorView,
  markName: string,
  attrName: string
): string | null {
  let commonValue: string | null | typeof NO_COMMON_VALUE | undefined;

  const hasSelectedText = forEachSelectedTextNode(view, ({ node }) => {
    const value = node.marks.find((mark) => mark.type.name === markName)?.attrs?.[attrName] ?? null;
    const normalizedValue = typeof value === 'string' && value.length > 0 ? value : null;

    if (commonValue === undefined) {
      commonValue = normalizedValue;
      return;
    }

    if (commonValue !== normalizedValue) {
      commonValue = NO_COMMON_VALUE;
    }
  }, { excludeRestrictedParents: true });

  if (!hasSelectedText || commonValue === undefined || commonValue === NO_COMMON_VALUE) {
    return null;
  }

  return commonValue;
}

function getSelectedFormattableText(view: EditorView): string | null {
  let text = '';
  let complete = true;

  forEachSelectedTextNode(view, ({ node, pos, selectedFrom, selectedTo }) => {
    if (!complete) return;
    const fromOffset = Math.max(0, selectedFrom - pos);
    const toOffset = Math.max(fromOffset, selectedTo - pos);
    const selectedText = (node.text ?? '').slice(fromOffset, toOffset);
    const remaining = MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS - text.length;
    if (selectedText.length > remaining) {
      text += selectedText.slice(0, Math.max(0, remaining));
      complete = false;
      return;
    }
    text += selectedText;
  }, { excludeRestrictedParents: true });

  return complete ? text : null;
}

function isPlainUrlLinkSelection(selectedText: string, href: string): boolean {
  if (!selectedText || !href) {
    return false;
  }

  const normalizedText = selectedText.trim();
  const normalizedHref = href.trim();
  if (normalizedText === normalizedHref) {
    return true;
  }

  if (normalizedText.startsWith('www.') && `https://${normalizedText}` === normalizedHref) {
    return true;
  }

  if (BARE_DOMAIN_HREF_PATTERN.test(normalizedText) && `https://${normalizedText}` === normalizedHref) {
    return true;
  }

  return normalizedHref.toLowerCase().startsWith('mailto:') &&
    normalizedHref.slice('mailto:'.length) === normalizedText;
}

export function getFormattableTextRanges(view: EditorView): TextRange[] {
  const ranges: TextRange[] = [];

  forEachSelectedTextNode(view, ({ selectedFrom, selectedTo }) => {
    if (ranges.length >= MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES) return;
    const previousRange = ranges.length > 0 ? ranges[ranges.length - 1] : null;
    if (previousRange && previousRange.to === selectedFrom) {
      previousRange.to = selectedTo;
      return;
    }

    ranges.push({
      from: selectedFrom,
      to: selectedTo,
    });
  }, { excludeRestrictedParents: true });

  return ranges;
}
