import type { IconData } from './types';
import { CALLOUT_COLORS, DEFAULT_CALLOUT_ICON, type CalloutColor } from './types';

const CALLOUT_ICON_TEXT_PREFIX = '[!callout-icon:';
const CALLOUT_ICON_TEXT_SUFFIX = ']';
const CALLOUT_ICON_COMMENT_PREFIX = 'callout-icon:';
const MAX_CALLOUT_ICON_VALUE_CHARS = 2048;
const MAX_CALLOUT_ICON_JSON_CHARS = 4096;
const MAX_CALLOUT_ICON_MARKER_CHARS = 4096;
const CALLOUT_COLOR_VALUES = new Set<string>(CALLOUT_COLORS);
const CALLOUT_ICON_HTML_COMMENT_PREFIX = `<!--${CALLOUT_ICON_COMMENT_PREFIX}`;
const CALLOUT_ICON_HTML_COMMENT_SUFFIX = '-->';

export function iconDataFromValue(value: string | null | undefined): IconData {
  if (!value || value.length > MAX_CALLOUT_ICON_VALUE_CHARS) {
    return DEFAULT_CALLOUT_ICON;
  }

  if (/^img:/i.test(value)) {
    return { type: 'image', value };
  }

  if (/^icon:/i.test(value)) {
    return { type: 'icon', value };
  }

  return { type: 'emoji', value };
}

export function normalizeCalloutIcon(value: unknown): IconData {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CALLOUT_ICON;
  }

  const record = value as Record<string, unknown>;
  const iconValue = typeof record.value === 'string' ? record.value : '';
  if (!iconValue || iconValue.length > MAX_CALLOUT_ICON_VALUE_CHARS) {
    return DEFAULT_CALLOUT_ICON;
  }

  const normalized: IconData = iconDataFromValue(iconValue);
  if (typeof record.color === 'string' && record.color.length <= 64) {
    normalized.color = record.color;
  }
  return normalized;
}

export function parseCalloutIconDatasetValue(value: string | undefined): IconData {
  if (!value || value.length > MAX_CALLOUT_ICON_JSON_CHARS) {
    return DEFAULT_CALLOUT_ICON;
  }

  try {
    return normalizeCalloutIcon(JSON.parse(value));
  } catch {
    return DEFAULT_CALLOUT_ICON;
  }
}

export function normalizeCalloutBackgroundColor(value: unknown): CalloutColor {
  return typeof value === 'string' && CALLOUT_COLOR_VALUES.has(value)
    ? value as CalloutColor
    : 'yellow';
}

export function getCalloutIconValue(icon: unknown): string {
  return normalizeCalloutIcon(icon).value;
}

export function encodeCalloutIconComment(iconValue: string): string {
  return `${CALLOUT_ICON_TEXT_PREFIX}${encodeURIComponent(iconValue)}${CALLOUT_ICON_TEXT_SUFFIX}`;
}

function decodeCalloutIconMarkerValue(value: string): string | null {
  if (!value || value.length > MAX_CALLOUT_ICON_MARKER_CHARS) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    return decoded.length <= MAX_CALLOUT_ICON_VALUE_CHARS ? decoded : null;
  } catch {
    return null;
  }
}

function getLeadingNonWhitespaceIndex(value: string): number {
  const match = /\S/u.exec(value.slice(0, MAX_CALLOUT_ICON_MARKER_CHARS));
  return match?.index ?? -1;
}

function findBoundedSuffix(value: string, start: number, suffix: string): number {
  const window = value.slice(start, start + MAX_CALLOUT_ICON_MARKER_CHARS + suffix.length);
  const suffixOffset = window.indexOf(suffix);
  return suffixOffset >= 0 ? start + suffixOffset : -1;
}

export function decodeCalloutIconComment(value: string): string | null {
  const prefixIndex = getLeadingNonWhitespaceIndex(value);
  if (prefixIndex < 0) {
    return null;
  }

  if (value.startsWith(CALLOUT_ICON_TEXT_PREFIX, prefixIndex)) {
    const markerStart = prefixIndex + CALLOUT_ICON_TEXT_PREFIX.length;
    const suffixIndex = findBoundedSuffix(value, markerStart, CALLOUT_ICON_TEXT_SUFFIX);
    if (suffixIndex > markerStart) {
      return decodeCalloutIconMarkerValue(value.slice(markerStart, suffixIndex));
    }
  }

  if (!value.startsWith(CALLOUT_ICON_HTML_COMMENT_PREFIX, prefixIndex)) {
    return null;
  }

  const markerStart = prefixIndex + CALLOUT_ICON_HTML_COMMENT_PREFIX.length;
  const suffixIndex = findBoundedSuffix(value, markerStart, CALLOUT_ICON_HTML_COMMENT_SUFFIX);
  if (suffixIndex <= markerStart) {
    return null;
  }

  const afterSuffix = value.slice(suffixIndex + CALLOUT_ICON_HTML_COMMENT_SUFFIX.length);
  if (afterSuffix.length > MAX_CALLOUT_ICON_MARKER_CHARS || /\S/u.test(afterSuffix)) {
    return null;
  }

  return decodeCalloutIconMarkerValue(value.slice(markerStart, suffixIndex));
}

export function removeLeadingCalloutIconTextMarker(value: string): string | null {
  const prefixIndex = getLeadingNonWhitespaceIndex(value);
  if (prefixIndex < 0 || !value.startsWith(CALLOUT_ICON_TEXT_PREFIX, prefixIndex)) {
    return null;
  }

  const markerStart = prefixIndex + CALLOUT_ICON_TEXT_PREFIX.length;
  const suffixIndex = findBoundedSuffix(value, markerStart, CALLOUT_ICON_TEXT_SUFFIX);
  if (suffixIndex <= markerStart || !decodeCalloutIconMarkerValue(value.slice(markerStart, suffixIndex))) {
    return null;
  }

  return value.slice(suffixIndex + CALLOUT_ICON_TEXT_SUFFIX.length).replace(/^\s+/u, '');
}
