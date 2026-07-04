const MAX_ACCOUNT_EMAIL_INPUT_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_CHARS = 320;
const MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS = 64;
const EMAIL_CODE_PATTERN = /^\d{6}$/;

export function normalizeEmailInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0
    && normalized.length <= MAX_ACCOUNT_EMAIL_CHARS
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
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
