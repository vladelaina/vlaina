import { describe, expect, it } from 'vitest';
import {
  getPipeShortcutColumnCount,
  getPipeShortcutCells,
  MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS,
  shouldCreateTableFromPipeShortcut,
} from './pipeTableShortcut';

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

  it('ignores oversized pipe rows before splitting cells', () => {
    expect(getPipeShortcutCells(`|${'x'.repeat(MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS)}|2|`)).toBeNull();
  });
});

describe('shouldCreateTableFromPipeShortcut', () => {
  it('allows compact pipe rows for quick table creation', () => {
    expect(shouldCreateTableFromPipeShortcut('|1|2|')).toBe(true);
  });

  it('does not grab spaced markdown table source rows before the delimiter line is typed', () => {
    expect(shouldCreateTableFromPipeShortcut('| 功能 | 操作步骤 | Windows | macOS |')).toBe(false);
  });
});
