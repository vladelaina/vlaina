import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMarkdownThemePreview,
  setMarkdownThemePreviewId,
  useEffectiveImportedMarkdownThemeId,
} from './markdownThemePreview';

describe('markdownThemePreview', () => {
  afterEach(() => clearMarkdownThemePreview());

  it('temporarily overrides the saved theme without changing it', () => {
    const { result } = renderHook(() => useEffectiveImportedMarkdownThemeId('saved-theme'));

    expect(result.current).toBe('saved-theme');

    act(() => setMarkdownThemePreviewId('preview-theme'));
    expect(result.current).toBe('preview-theme');

    act(() => setMarkdownThemePreviewId(null));
    expect(result.current).toBeNull();

    act(() => clearMarkdownThemePreview());
    expect(result.current).toBe('saved-theme');
  });
});
