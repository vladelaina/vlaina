import { describe, expect, it } from 'vitest';
import { canPersistNoteScrollPosition } from './MarkdownEditor';

describe('canPersistNoteScrollPosition', () => {
  it('allows visible scroll roots to persist their current scroll position', () => {
    const scrollRoot = document.createElement('div');
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollHeight', { value: 1800, configurable: true });
    document.body.append(scrollRoot);

    expect(canPersistNoteScrollPosition(scrollRoot)).toBe(true);

    scrollRoot.remove();
  });

  it('rejects hidden scroll roots so they cannot overwrite a saved position with zero', () => {
    const scrollRoot = document.createElement('div');
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 0, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollHeight', { value: 0, configurable: true });
    document.body.append(scrollRoot);

    expect(canPersistNoteScrollPosition(scrollRoot)).toBe(false);

    scrollRoot.remove();
  });
});
