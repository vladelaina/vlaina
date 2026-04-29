import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeTextToClipboard } from './blockSelectionClipboard';

describe('writeTextToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses execCommand when it can copy text', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    await expect(writeTextToClipboard('copied text')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses navigator clipboard when execCommand cannot copy', async () => {
    const execCommand = vi.fn().mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await expect(writeTextToClipboard('navigator text')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('navigator text');
  });

  it('retries execCommand after navigator clipboard fails', async () => {
    const execCommand = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await expect(writeTextToClipboard('fallback text')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledTimes(2);
  });

  it('returns false when every clipboard path fails', async () => {
    const execCommand = vi.fn().mockReturnValue(false);
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await expect(writeTextToClipboard('lost text')).resolves.toBe(false);
  });
});
