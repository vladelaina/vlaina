import { MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';

export const MAX_FETCHED_IMAGE_BYTES = MAX_INLINE_IMAGE_BYTES;

export type BoundedImageBlobFetchResult =
  | { status: 'ok'; blob: Blob }
  | { status: 'too-large'; blob: null };

interface FetchBoundedImageBlobOptions {
  maxBytes?: number;
  fetchInit?: RequestInit;
}

function getMaxBytes(options: FetchBoundedImageBlobOptions | undefined): number {
  const maxBytes = options?.maxBytes;
  return typeof maxBytes === 'number' && Number.isFinite(maxBytes) && maxBytes >= 0
    ? maxBytes
    : MAX_FETCHED_IMAGE_BYTES;
}

function readContentLength(response: Response): number | null {
  const raw = response.headers?.get?.('content-length');
  if (!raw) {
    return null;
  }

  const size = Number(raw);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
  }
}

async function readResponseStreamBlob(response: Response, maxBytes: number): Promise<Blob | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    return blob.size <= maxBytes ? blob : null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(chunks, {
    type: response.headers?.get?.('content-type') || '',
  });
}

export async function fetchBoundedImageBlobResult(
  src: string,
  options?: FetchBoundedImageBlobOptions,
): Promise<BoundedImageBlobFetchResult> {
  const response = options?.fetchInit === undefined
    ? await fetch(src)
    : await fetch(src, options.fetchInit);
  return readBoundedImageBlobResponse(response, options);
}

export async function readBoundedImageBlobResponse(
  response: Response,
  options?: Pick<FetchBoundedImageBlobOptions, 'maxBytes'>,
): Promise<BoundedImageBlobFetchResult> {
  const maxBytes = getMaxBytes(options);
  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > maxBytes) {
    await cancelResponseBody(response);
    return { status: 'too-large', blob: null };
  }

  const blob = await readResponseStreamBlob(response, maxBytes);
  if (!blob || blob.size > maxBytes) {
    return { status: 'too-large', blob: null };
  }

  return { status: 'ok', blob };
}

export async function fetchBoundedImageBlob(src: string, options?: FetchBoundedImageBlobOptions): Promise<Blob | null> {
  const result = await fetchBoundedImageBlobResult(src, options);
  return result.status === 'ok' ? result.blob : null;
}
