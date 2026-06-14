export const MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES = 64 * 1024;
const MAX_SETTINGS_API_JSON_CONTENT_LENGTH_CHARS = 32;

function createSettingsApiResponseTooLargeError(): Error {
  return new Error('Settings API response body is too large.');
}

function readContentLength(response: Response): number | null {
  const rawContentLength = response.headers.get('content-length');
  if (!rawContentLength) {
    return null;
  }

  if (rawContentLength.length > MAX_SETTINGS_API_JSON_CONTENT_LENGTH_CHARS) {
    return null;
  }
  const trimmed = rawContentLength.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readSettingsApiResponseText(response: Response): Promise<string> {
  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES) {
    void response.body?.cancel().catch(() => undefined);
    throw createSettingsApiResponseTooLargeError();
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw createSettingsApiResponseTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readSettingsApiJson<T>(response: Response): Promise<T> {
  const text = await readSettingsApiResponseText(response);
  return JSON.parse(text) as T;
}
