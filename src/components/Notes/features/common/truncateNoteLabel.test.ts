import { describe, expect, it } from 'vitest';
import { truncateNoteLabel } from './truncateNoteLabel';

describe('truncateNoteLabel', () => {
  it('keeps short labels and truncates long labels to fifteen visible characters plus ellipsis', () => {
    expect(truncateNoteLabel('short-name')).toBe('short-name');
    expect(truncateNoteLabel('very-long-note-name')).toBe('very-long-note-....');
    expect(truncateNoteLabel('一二三四五六七八九十甲乙丙丁戊己')).toBe('一二三四五六七八九十甲乙丙丁戊....');
  });
});
