import { getEffectiveAppLanguage } from '@/lib/i18n/languages';
import { normalizeExternalHref } from '@/lib/navigation/externalLinks';
import { useUIStore } from '@/stores/uiSlice';

const MAX_AUTH_INTENT_STORAGE_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_INPUT_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_CHARS = 320;
const MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS = 64;
const AUTH_REDIRECT_UNSAFE_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const EMAIL_CODE_PATTERN = /^\d{6}$/;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmailInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= MAX_ACCOUNT_EMAIL_CHARS && isValidEmail(normalized)
    ? normalized
    : null;
}

export function normalizeEmailCodeInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim();
  return EMAIL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function getCurrentEmailAuthLocale(): string {
  return getEffectiveAppLanguage(useUIStore.getState().languagePreference);
}

export function isAuthorizationCancellation(message: string): boolean {
  return /^(?:authorization )?(?:cancelled|canceled)$/i.test(message.trim())
    || /^access_denied$/i.test(message.trim());
}

export function readStoredAuthIntentValue(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    return value && value.length <= MAX_AUTH_INTENT_STORAGE_CHARS ? value : null;
  } catch {
    return null;
  }
}

export function isValidAuthIntentValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_AUTH_INTENT_STORAGE_CHARS;
}

export function normalizeWebAuthRedirectUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_AUTH_INTENT_STORAGE_CHARS) {
    return null;
  }

  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_AUTH_INTENT_STORAGE_CHARS
    || AUTH_REDIRECT_UNSAFE_CHARS_REGEX.test(trimmed)
    || trimmed.includes('\\')
  ) {
    return null;
  }

  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  const normalized = normalizeExternalHref(trimmed);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null;
  } catch {
    return null;
  }
}
