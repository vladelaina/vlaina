import { translate, type MessageKey } from '@/lib/i18n';

const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/i;
const SANITIZE_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gi;
type FileNameErrorKey = Extract<MessageKey, `notes.fileNameError.${string}`>;

export function sanitizeFileName(name: string): string {
  let sanitized = name.replace(SANITIZE_FILE_NAME_PATTERN, '');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}

export function getInvalidFileNameMessageKey(name: string): FileNameErrorKey | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'notes.fileNameError.empty';
  }

  if (INVALID_FILE_NAME_PATTERN.test(trimmed)) {
    return 'notes.fileNameError.unsupportedCharacters';
  }

  if (trimmed.replace(/\./g, '').length === 0) {
    return 'notes.fileNameError.onlyDots';
  }

  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return 'notes.fileNameError.dotBoundary';
  }

  return null;
}

export function getInvalidFileNameReason(name: string): string | null {
  const messageKey = getInvalidFileNameMessageKey(name);
  return messageKey ? translate(messageKey) : null;
}

export function isValidFileName(name: string): boolean {
  return getInvalidFileNameMessageKey(name) === null;
}

export function assertValidFileName(name: string): void {
  const messageKey = getInvalidFileNameMessageKey(name);
  if (messageKey) {
    throw new Error(translate(messageKey));
  }
}
