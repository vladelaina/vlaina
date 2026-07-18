import fs from 'node:fs';

const maxUpdateDownloadBytes = 1024 * 1024 * 1024;

export async function writeResponseBodyToFile(response, filePath, {
  append = false,
  existingBytes = 0,
} = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Update download response body is unavailable.');
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && existingBytes + contentLength > maxUpdateDownloadBytes) {
    throw new Error('Update download is too large.');
  }

  const reader = response.body.getReader();
  const stream = fs.createWriteStream(filePath, { flags: append ? 'a' : 'w' });
  let rejectStreamError;
  const streamErrorPromise = new Promise((_, reject) => {
    rejectStreamError = reject;
  });
  const handleStreamError = (error) => rejectStreamError(error);
  stream.once('error', handleStreamError);
  let downloadedBytes = 0;

  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), streamErrorPromise]);
      if (done) break;
      const chunk = Buffer.from(value);
      downloadedBytes += chunk.byteLength;
      if (existingBytes + downloadedBytes > maxUpdateDownloadBytes) {
        throw new Error('Update download is too large.');
      }
      if (!stream.write(chunk)) {
        await Promise.race([
          new Promise((resolve) => stream.once('drain', resolve)),
          streamErrorPromise,
        ]);
      }
    }

    await Promise.race([
      new Promise((resolve, reject) => {
        stream.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
      streamErrorPromise,
    ]);
  } catch (error) {
    stream.destroy();
    throw error;
  } finally {
    stream.removeListener('error', handleStreamError);
    reader.releaseLock();
  }

  if (existingBytes + downloadedBytes <= 0) {
    throw new Error('Update download is empty.');
  }

  return existingBytes + downloadedBytes;
}
