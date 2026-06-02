import { describe, expect, it } from 'vitest';
import { ensureMarkdownFileName, getNoteTitleFromPath, stripMarkdownExtension } from './displayName';

describe('note display name helpers', () => {
  it('strips every supported markdown extension from display titles', () => {
    expect(getNoteTitleFromPath('alpha.md')).toBe('alpha');
    expect(getNoteTitleFromPath('docs/beta.markdown')).toBe('beta');
    expect(stripMarkdownExtension('gamma.mdown')).toBe('gamma');
    expect(stripMarkdownExtension('delta.mkd')).toBe('delta');
  });

  it('keeps existing supported markdown filenames when normalizing names', () => {
    expect(ensureMarkdownFileName('alpha.md')).toBe('alpha.md');
    expect(ensureMarkdownFileName('beta.markdown')).toBe('beta.markdown');
    expect(ensureMarkdownFileName('gamma.mdown')).toBe('gamma.mdown');
    expect(ensureMarkdownFileName('delta.mkd')).toBe('delta.mkd');
    expect(ensureMarkdownFileName('plain')).toBe('plain.md');
  });
});
