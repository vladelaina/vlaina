import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyDocumentColorModeClass,
  normalizeColorModePreference,
  syncDocumentColorModeClass,
} from './colorModeSync';

describe('colorModeSync', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  it('normalizes unsupported color mode preferences to system', () => {
    expect(normalizeColorModePreference('dark')).toBe('dark');
    expect(normalizeColorModePreference('light')).toBe('light');
    expect(normalizeColorModePreference('unknown')).toBe('system');
    expect(normalizeColorModePreference(undefined)).toBe('system');
  });

  it('applies mutually exclusive light and dark classes to the document root', () => {
    applyDocumentColorModeClass('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyDocumentColorModeClass('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('syncs explicit preferences immediately', () => {
    const cleanup = syncDocumentColorModeClass('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    cleanup();
  });

  it('syncs system preference changes through matchMedia', () => {
    let dark = true;
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: vi.fn((_event: string, callback: () => void) => {
        listeners.push(callback);
      }),
      removeEventListener: vi.fn(),
    })));

    const cleanup = syncDocumentColorModeClass('system');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    dark = false;
    const listener = listeners[0];
    if (!listener) throw new Error('Expected matchMedia listener to be registered.');
    listener();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    cleanup();
  });
});
