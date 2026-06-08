import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportedMarkdownThemeMetadata } from '@/lib/markdown/theme-compatibility/types';
import { useImportedMarkdownThemePlatform } from './useImportedMarkdownThemePlatform';

const mocks = vi.hoisted(() => ({
  readImportedMarkdownThemeMetadata: vi.fn(),
}));

vi.mock('@/lib/markdown/theme-compatibility/importedThemeStorage', () => ({
  readImportedMarkdownThemeMetadata: (...args: unknown[]) =>
    mocks.readImportedMarkdownThemeMetadata(...args),
}));

function themeMetadata(theme: Partial<ImportedMarkdownThemeMetadata>): ImportedMarkdownThemeMetadata {
  return {
    id: 'clean-light',
    name: 'Clean Light',
    platform: 'typora',
    cssFile: 'clean-light.css',
    sourcePath: null,
    createdAt: 1,
    updatedAt: 1,
    ...theme,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useImportedMarkdownThemePlatform', () => {
  it('does not read metadata when no imported theme is selected', () => {
    const view = renderHook(({ id }: { id: string | null }) =>
      useImportedMarkdownThemePlatform(id),
    {
      initialProps: { id: null },
    });

    expect(view.result.current).toBeNull();
    expect(mocks.readImportedMarkdownThemeMetadata).not.toHaveBeenCalled();
  });

  it('resolves the selected imported theme platform from metadata only', async () => {
    mocks.readImportedMarkdownThemeMetadata.mockResolvedValue(themeMetadata({
      id: 'minimal',
      platform: 'obsidian',
      cssFile: 'minimal.css',
    }));

    const view = renderHook(({ id }: { id: string | null }) =>
      useImportedMarkdownThemePlatform(id),
    {
      initialProps: { id: 'minimal' },
    });

    await waitFor(() => {
      expect(view.result.current).toBe('obsidian');
    });
    expect(mocks.readImportedMarkdownThemeMetadata).toHaveBeenCalledWith('minimal');
  });

  it('ignores stale metadata results after the selected theme id changes', async () => {
    const cleanLight = deferred<ImportedMarkdownThemeMetadata | null>();
    const minimal = deferred<ImportedMarkdownThemeMetadata | null>();
    mocks.readImportedMarkdownThemeMetadata.mockImplementation((id: string) => {
      if (id === 'clean-light') return cleanLight.promise;
      if (id === 'minimal') return minimal.promise;
      return Promise.resolve(null);
    });

    const view = renderHook(({ id }: { id: string | null }) =>
      useImportedMarkdownThemePlatform(id),
    {
      initialProps: { id: 'clean-light' },
    });

    view.rerender({ id: 'minimal' });

    await act(async () => {
      cleanLight.resolve(themeMetadata({ id: 'clean-light', platform: 'typora' }));
      await Promise.resolve();
    });
    expect(view.result.current).toBeNull();

    await act(async () => {
      minimal.resolve(themeMetadata({
        id: 'minimal',
        platform: 'obsidian',
        cssFile: 'minimal.css',
      }));
      await Promise.resolve();
    });
    expect(view.result.current).toBe('obsidian');
  });
});
