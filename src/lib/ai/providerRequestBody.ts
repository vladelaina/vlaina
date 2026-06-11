import { measureRequestJsonLength } from './requestContext';

export const MAX_PROVIDER_JSON_REQUEST_BODY_CHARS = 64 * 1024 * 1024;

export function assertProviderJsonRequestBodySize(
  body: unknown,
  maxChars = MAX_PROVIDER_JSON_REQUEST_BODY_CHARS,
): void {
  if (measureRequestJsonLength(body, maxChars) > maxChars) {
    throw new Error('AI provider request body is too large.');
  }
}

export function stringifyProviderJsonRequestBody(
  body: unknown,
  maxChars = MAX_PROVIDER_JSON_REQUEST_BODY_CHARS,
): string {
  assertProviderJsonRequestBodySize(body, maxChars);
  return JSON.stringify(body);
}
