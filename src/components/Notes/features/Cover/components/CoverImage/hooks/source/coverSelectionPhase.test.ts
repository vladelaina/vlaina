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

  it('prioritizes error over other states', () => {
    expect(resolveCoverFlowPhase({
      url: '@monet/1',
      previewSrc: '/preview.webp',
      isError: true,
      isSelectionCommitting: true,
    })).toBe('error');
  });

  it('returns committing before previewing when commit is active', () => {
    expect(resolveCoverFlowPhase({
      url: '@monet/1',
      previewSrc: '/preview.webp',
      isError: false,
      isSelectionCommitting: true,
    })).toBe('committing');
  });

  it('returns previewing when a preview is active without commit', () => {
    expect(resolveCoverFlowPhase({
      url: '@monet/1',
      previewSrc: '/preview.webp',
      isError: false,
      isSelectionCommitting: false,
    })).toBe('previewing');
  });

  it('returns ready when only resolved content should be shown', () => {
    expect(resolveCoverFlowPhase({
      url: '@monet/1',
      previewSrc: null,
      isError: false,
      isSelectionCommitting: false,
    })).toBe('ready');
  });
});
