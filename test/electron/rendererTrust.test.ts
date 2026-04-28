import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isTrustedRendererUrl } from '../../electron/rendererTrust.mjs';

describe('Electron renderer trust boundary', () => {
  const rendererFile = path.join('/app', 'dist', 'index.html');
  const rendererDevUrl = 'http://127.0.0.1:3000';

  it('trusts the configured dev server origin', () => {
    expect(
      isTrustedRendererUrl('http://127.0.0.1:3000/src/App.tsx', {
        rendererDevUrl,
        rendererFile,
      }),
    ).toBe(true);
  });

  it('trusts only the packaged renderer file URL', () => {
    expect(
      isTrustedRendererUrl(pathToFileURL(rendererFile).toString(), {
        rendererDevUrl,
        rendererFile,
      }),
    ).toBe(true);

    expect(
      isTrustedRendererUrl(pathToFileURL(path.join('/tmp', 'evil.html')).toString(), {
        rendererDevUrl,
        rendererFile,
      }),
    ).toBe(false);
  });

  it('rejects malformed and unrelated renderer URLs', () => {
    expect(isTrustedRendererUrl('not a url', { rendererDevUrl, rendererFile })).toBe(false);
    expect(isTrustedRendererUrl('https://example.com', { rendererDevUrl, rendererFile })).toBe(false);
  });
});
