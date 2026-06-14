import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { isImageFilename } from '@/lib/assets/core/naming';
import { isAbsolutePath } from '@/lib/storage/adapter/pathUtils';

const ICON_IMAGE_SCHEME_PATTERN = /^img:/i;
const ICON_SYMBOL_SCHEME_PATTERN = /^icon:/i;
const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*\\+:/i;
const UNSAFE_ICON_VALUE_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const ICON_SYMBOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const ICON_SYMBOL_COLOR_PATTERN = /^(?:currentColor|#[0-9A-Fa-f]{3,8}|var\(--[A-Za-z0-9_-]{1,128}\)|[A-Za-z][A-Za-z0-9_-]{0,63})$/;
const BARE_ICON_NAME_PATTERN = /^(?:window|common|chat|nav|sidebar|user|theme|file|editor|media|misc)\.[A-Za-z0-9_.-]{1,128}$/;
const FLAG_EMOJI_PATTERN = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP_EMOJI_PATTERN = /^[#*0-9]\uFE0F?\u20E3$/u;
const PICTOGRAPHIC_EMOJI_PATTERN =
  /^(?:\p{Emoji_Presentation}[\uFE0E\uFE0F]?|\p{Extended_Pictographic}\uFE0F?)(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}[\uFE0E\uFE0F]?|\p{Extended_Pictographic}\uFE0F?)(?:\p{Emoji_Modifier})?)*$/u;

export const MAX_NOTE_ICON_VALUE_CHARS = 4096;

function stripPreviewSuffix(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? '';
}

function normalizeIconString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_NOTE_ICON_VALUE_CHARS ||
    UNSAFE_ICON_VALUE_CHARS.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

export function hasIconImageScheme(value: string): boolean {
  return ICON_IMAGE_SCHEME_PATTERN.test(value);
}

export function hasIconSymbolScheme(value: string): boolean {
  return ICON_SYMBOL_SCHEME_PATTERN.test(value);
}

export function getPlainIconImagePath(value: string): string | null {
  const path = normalizeIconString(value);
  if (
    !path ||
    hasIconImageScheme(path) ||
    hasIconSymbolScheme(path) ||
    URI_SCHEME_PATTERN.test(path) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(path) ||
    isAbsolutePath(path) ||
    hasInternalNoteAssetUrlPathSegment(path)
  ) {
    return null;
  }

  return isImageFilename(stripPreviewSuffix(path)) ? path : null;
}

export function isIconImageValue(value: string): boolean {
  return getPlainIconImagePath(value) !== null;
}

export function parseIconSymbolValue(value: string): { name: string; color?: string } | null {
  const icon = normalizeIconString(value);
  if (!icon || !hasIconSymbolScheme(icon)) {
    return null;
  }

  const parts = icon.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const name = parts[1] ?? '';
  const color = parts[2];
  if (!ICON_SYMBOL_NAME_PATTERN.test(name)) {
    return null;
  }
  if (color !== undefined && color !== '' && !ICON_SYMBOL_COLOR_PATTERN.test(color)) {
    return null;
  }

  return color ? { name, color } : { name };
}

export function isBareIconNameValue(value: string): boolean {
  const icon = normalizeIconString(value);
  return !!icon && BARE_ICON_NAME_PATTERN.test(icon);
}

export function isEmojiIconValue(value: string): boolean {
  const icon = normalizeIconString(value);
  return !!icon && (
    FLAG_EMOJI_PATTERN.test(icon) ||
    KEYCAP_EMOJI_PATTERN.test(icon) ||
    PICTOGRAPHIC_EMOJI_PATTERN.test(icon)
  );
}

export function isStandardNoteIconValue(value: string): boolean {
  const icon = normalizeIconString(value);
  return !!icon && (
    isEmojiIconValue(icon) ||
    getPlainIconImagePath(icon) !== null ||
    parseIconSymbolValue(icon) !== null ||
    isBareIconNameValue(icon)
  );
}

export function normalizeStandardNoteIconValue(value: unknown): string | null {
  const icon = normalizeIconString(value);
  return icon && isStandardNoteIconValue(icon) ? icon : null;
}
