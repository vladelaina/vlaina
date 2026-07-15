import { describe, expect, it } from 'vitest';
import { resolveCoverFlowPhase } from './coverSelectionPhase';

describe('resolveCoverFlowPhase', () => {
  it('returns idle when neither url nor preview is present', () => {
    expect(resolveCoverFlowPhase({
      url: null,
      previewSrc: null,
      isError: false,
      isSelectionCommitting: false,
    })).toBe('idle');
  });

  it('keeps a valid preview visible over a current-cover error', () => {
    expect(resolveCoverFlowPhase({
      url: 'assets/cover.png',
      previewSrc: '/preview.webp',
      isError: true,
      isSelectionCommitting: false,
    })).toBe('previewing');
  });

  it('returns committing before previewing when commit is active', () => {
    expect(resolveCoverFlowPhase({
      url: 'assets/cover.png',
      previewSrc: '/preview.webp',
      isError: false,
      isSelectionCommitting: true,
    })).toBe('committing');
  });

  it('keeps committing active before the selected url reaches props', () => {
    expect(resolveCoverFlowPhase({
      url: null,
      previewSrc: null,
      isError: false,
      isSelectionCommitting: true,
    })).toBe('committing');
  });

  it('returns previewing when a preview is active without commit', () => {
    expect(resolveCoverFlowPhase({
      url: 'assets/cover.png',
      previewSrc: '/preview.webp',
      isError: false,
      isSelectionCommitting: false,
    })).toBe('previewing');
  });

  it('returns ready when only resolved content should be shown', () => {
    expect(resolveCoverFlowPhase({
      url: 'assets/cover.png',
      previewSrc: null,
      isError: false,
      isSelectionCommitting: false,
    })).toBe('ready');
  });
});
