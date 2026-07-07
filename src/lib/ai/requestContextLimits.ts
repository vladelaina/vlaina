export const REQUEST_HISTORY_MESSAGE_OVERHEAD = 48;
export const MAX_REQUEST_HISTORY_MESSAGES = 32;
export const MAX_REQUEST_HISTORY_CHARS = 24000;
export const MAX_REQUEST_MESSAGE_CHARS = 6000;
export const MAX_CURRENT_REQUEST_MESSAGE_CHARS = 160_000;
export const MAX_CURRENT_REQUEST_CONTENT_PARTS = 128;
export const MAX_TRANSCRIPT_FIELD_CHARS = 1200;
export const MAX_REQUEST_JSON_DEPTH = 8;
export const MAX_REQUEST_JSON_ARRAY_ITEMS = 100_000;
export const CONTENT_TRUNCATION_MARKER = '\n[Earlier content omitted]\n';

export function clipContentToBudget(content: string, maxChars: number): string {
  if (maxChars <= 0) {
    return '';
  }

  if (content.length <= maxChars) {
    return content;
  }

  if (maxChars <= CONTENT_TRUNCATION_MARKER.length + 16) {
    return content.slice(-maxChars);
  }

  const availableChars = maxChars - CONTENT_TRUNCATION_MARKER.length;
  const prefixChars = Math.ceil(availableChars * 0.6);
  const suffixChars = Math.max(availableChars - prefixChars, 0);
  const suffix = suffixChars > 0 ? content.slice(-suffixChars) : '';
  return `${content.slice(0, prefixChars)}${CONTENT_TRUNCATION_MARKER}${suffix}`;
}
