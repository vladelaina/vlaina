import { createAbortError, raceWithAbort, throwIfAborted } from './providerHttpAbort';

const MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES = 64 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function assertDesktopProviderRequestBodySize(byteLength: number): void {
  if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES) {
    throw new Error('Desktop AI provider request body is too large.');
  }
}

function assertDesktopProviderRequestTextSize(value: string): void {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      byteLength += 1;
    } else if (code <= 0x7ff) {
      byteLength += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        byteLength += 4;
        index += 1;
      } else {
        byteLength += 3;
      }
    } else {
      byteLength += 3;
    }

    if (byteLength > MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES) {
      throw new Error('Desktop AI provider request body is too large.');
    }
  }
}

function readBlobAsArrayBuffer(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  const arrayBuffer = (blob as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof arrayBuffer === 'function') {
    return raceWithAbort(arrayBuffer.call(blob), signal);
  }

  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('Desktop AI provider binary requests require Blob.arrayBuffer or FileReader support.'));
  }

  const reader = new FileReader();
  const promise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Desktop AI provider binary request body could not be read as bytes.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Desktop AI provider binary request body could not be read.'));
    };
    reader.onabort = () => {
      reject(createAbortError());
    };
    reader.readAsArrayBuffer(blob);
  });
  return raceWithAbort(promise, signal, () => {
    try {
      reader.abort();
    } catch {
    }
  });
}

export async function normalizeDesktopRequestBody(body: BodyInit | null | undefined, signal?: AbortSignal): Promise<{
  body?: string;
  bodyBase64?: string;
}> {
  throwIfAborted(signal);
  if (body == null) {
    return {};
  }
  if (typeof body === 'string') {
    assertDesktopProviderRequestTextSize(body);
    return { body };
  }
  if (body instanceof Blob) {
    assertDesktopProviderRequestBodySize(body.size);
    const bytes = new Uint8Array(await readBlobAsArrayBuffer(body, signal));
    assertDesktopProviderRequestBodySize(bytes.byteLength);
    return { bodyBase64: bytesToBase64(bytes) };
  }
  if (body instanceof ArrayBuffer) {
    assertDesktopProviderRequestBodySize(body.byteLength);
    return { bodyBase64: bytesToBase64(new Uint8Array(body)) };
  }
  if (ArrayBuffer.isView(body)) {
    assertDesktopProviderRequestBodySize(body.byteLength);
    return { bodyBase64: bytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)) };
  }
  throw new Error('Unsupported desktop AI provider request body.');
}
