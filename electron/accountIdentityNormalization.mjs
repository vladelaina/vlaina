import { normalizeHttpUrl } from './externalUrlPolicy.mjs';

const maxAccountIdentityNameChars = 256;
const maxAccountIdentityEmailChars = 320;
const maxAccountIdentityAvatarUrlChars = 4096;
const maxAccountIdentityMembershipNameChars = 128;
const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function normalizeDesktopAccountIdentityString(value, maxChars) {
  if (typeof value !== 'string' || value.length > maxChars) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars || controlOrBidiPattern.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function normalizeDesktopAccountUsername(value) {
  return normalizeDesktopAccountIdentityString(value, maxAccountIdentityNameChars);
}

export function normalizeDesktopAccountEmail(value) {
  return normalizeDesktopAccountIdentityString(value, maxAccountIdentityEmailChars);
}

export function normalizeDesktopAccountMembershipName(value) {
  return normalizeDesktopAccountIdentityString(value, maxAccountIdentityMembershipNameChars);
}

export function normalizeDesktopAccountAvatarUrl(value) {
  const trimmed = normalizeDesktopAccountIdentityString(value, maxAccountIdentityAvatarUrlChars);
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeHttpUrl(trimmed, 'avatar URL');
  } catch {
    return null;
  }
}
