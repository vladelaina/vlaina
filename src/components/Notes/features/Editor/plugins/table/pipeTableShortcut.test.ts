import { describe, expect, it } from 'vitest';
import { getPipeShortcutColumnCount } from './pipeTableShortcut';

describe('getPipeShortcutColumnCount', () => {
  it('detects two columns from a pipe row', () => {
    expect(getPipeShortcutColumnCount('|1|2|')).toBe(2);
  });

  it('detects three columns from a pipe row', () => {
    expect(getPipeShortcutColumnCount('|1|2|3|')).toBe(3);
  });

  it('supports fullwidth pipes', () => {
    expect(getPipeShortcutColumnCount('｜1｜2｜')).toBe(2);
  });

  it('ignores rows with fewer than two cells', () => {
    expect(getPipeShortcutColumnCount('|1|')).toBeNull();
  });

  it('ignores plain text', () => {
    expect(getPipeShortcutColumnCount('hello world')).toBeNull();
  });
});
