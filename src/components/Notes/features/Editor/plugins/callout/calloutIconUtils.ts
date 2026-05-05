import type { IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';

const CALLOUT_ICON_TEXT_PREFIX = '[!callout-icon:';
const CALLOUT_ICON_TEXT_SUFFIX = ']';
const CALLOUT_ICON_COMMENT_PREFIX = 'callout-icon:';

export function iconDataFromValue(value: string | null | undefined): IconData {
  if (!value) {
    return DEFAULT_CALLOUT_ICON;
  }

  if (value.startsWith('img:')) {
    return { type: 'image', value };
  }

  if (value.startsWith('icon:')) {
    return { type: 'icon', value };
  }

  return { type: 'emoji', value };
}

export function getCalloutIconValue(icon: unknown): string {
  if (!icon || typeof icon !== 'object') {
    return DEFAULT_CALLOUT_ICON.value;
  }

  const value = (icon as { value?: unknown }).value;
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_CALLOUT_ICON.value;
}

export function encodeCalloutIconComment(iconValue: string): string {
  return `${CALLOUT_ICON_TEXT_PREFIX}${encodeURIComponent(iconValue)}${CALLOUT_ICON_TEXT_SUFFIX}`;
}

export function decodeCalloutIconComment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(CALLOUT_ICON_TEXT_PREFIX)) {
    const suffixIndex = trimmed.indexOf(CALLOUT_ICON_TEXT_SUFFIX, CALLOUT_ICON_TEXT_PREFIX.length);
    if (suffixIndex > CALLOUT_ICON_TEXT_PREFIX.length) {
      try {
        return decodeURIComponent(trimmed.slice(CALLOUT_ICON_TEXT_PREFIX.length, suffixIndex));
      } catch {
        return null;
      }
    }
  }

  if (!trimmed.startsWith(`<!--${CALLOUT_ICON_COMMENT_PREFIX}`) || !trimmed.endsWith('-->')) {
    return null;
  }

  const encoded = trimmed.slice(
    `<!--${CALLOUT_ICON_COMMENT_PREFIX}`.length,
    -'-->'.length
  );

  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
