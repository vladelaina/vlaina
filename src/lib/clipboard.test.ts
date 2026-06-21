import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeTextToClipboard } from './clipboard';

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => null,
}));

describe('writeTextToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    });
  });

  it('removes the fallback textarea if focusing it fails', async () => {
    const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, 'focus').mockImplementationOnce(() => {
      throw new Error('focus failed');
    });

    await expect(writeTextToClipboard('copied text')).resolves.toBe(false);

    expect(focusSpy).toHaveBeenCalled();
    expect(document.execCommand).not.toHaveBeenCalled();
    expect(document.body.querySelector('textarea')).toBeNull();
  });
});
