import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollCurrentNoteToTop } from './scrollCurrentNoteToTop';

describe('scrollCurrentNoteToTop', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrolls the current note to the top without smooth animation', () => {
    const scrollRoot = document.createElement('div');
    const scrollTo = vi.fn();
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.scrollTo = scrollTo;
    document.body.append(scrollRoot);

    expect(scrollCurrentNoteToTop()).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('returns false when the note scroll root is unavailable', () => {
    expect(scrollCurrentNoteToTop()).toBe(false);
  });
});
