import { afterEach, describe, expect, it, vi } from 'vitest';
import { setClipboardText, writeTextToClipboard } from './blockSelectionClipboard';

describe('writeTextToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).vlainaDesktop;
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });

  it('uses execCommand when modern clipboard APIs are unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    await expect(writeTextToClipboard('copied text')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses navigator clipboard before execCommand fallback', async () => {
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
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('uses electron clipboard before browser clipboard paths', async () => {
    const execCommand = vi.fn().mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const navigatorWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: navigatorWriteText },
      configurable: true,
    });
    (window as any).vlainaDesktop = {
      platform: 'electron',
      clipboard: { writeText },
    };

    await expect(writeTextToClipboard('electron text')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('electron text');
    expect(navigatorWriteText).not.toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to execCommand after navigator clipboard fails', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
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
    expect(execCommand).toHaveBeenCalledTimes(1);
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

  it('restores focus and native selection after execCommand fallback', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    const input = document.createElement('input');
    input.value = 'selected text';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(0, input.value.length);

    try {
      await expect(writeTextToClipboard('copied text')).resolves.toBe(true);

      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    } finally {
      input.remove();
    }
  });
});

describe('setClipboardText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).vlainaDesktop;
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });

  it('uses the shared clipboard helper when clipboardData is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const event = {
      preventDefault: vi.fn(),
      clipboardData: null,
    } as unknown as ClipboardEvent;

    setClipboardText(event, 'fallback block text');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('fallback block text');
  });
});
