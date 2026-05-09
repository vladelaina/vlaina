import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLineBreakDebugLog,
  compareLineBreakText,
  getLineBreakDebugLogText,
  getNotesDebugLogText,
  logLineBreakDebug,
  logNotesDebug,
  logNotesDebugAlways,
  summarizeLineBreakText,
} from './lineBreakDebugLog';

describe('lineBreakDebugLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearLineBreakDebugLog();
  });

  it('keeps a copyable log buffer by default without printing during tests', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logLineBreakDebug('editor:test', { lines: 3 });

    expect(debug).not.toHaveBeenCalled();
    expect(getLineBreakDebugLogText()).toContain('[NotesLineBreak] editor:test');
    expect(getLineBreakDebugLogText()).toContain('"lines":3');
  });

  it('keeps generic notes debug logs in the same copyable buffer', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logNotesDebug('NotesAutoDraft', 'evaluate', { blockedReasons: ['has-current-note'] });

    expect(debug).not.toHaveBeenCalled();
    expect(getNotesDebugLogText()).toContain('[NotesAutoDraft] evaluate');
    expect(getLineBreakDebugLogText()).toContain('[NotesAutoDraft] evaluate');
  });

  it('keeps forced load logs buffered without printing during tests', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logNotesDebugAlways('NotesLoad', 'file-tree:start', { durationMs: 1 });

    expect(debug).not.toHaveBeenCalled();
    expect(getNotesDebugLogText()).toContain('[NotesLoad] file-tree:start');
  });

  it('clears buffered log text', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    logLineBreakDebug('editor:test');
    clearLineBreakDebugLog();

    expect(getLineBreakDebugLogText()).toBe('');
  });

  it('summarizes line break diffs', () => {
    expect(compareLineBreakText('1\n2\n3', '123')).toMatchObject({
      equal: false,
      previousLines: 3,
      nextLines: 1,
      lineDelta: -2,
      firstDiffIndex: 1,
    });
  });

  it('does not include document text in line break summaries or diffs', () => {
    expect(JSON.stringify(summarizeLineBreakText('secret\nmarkdown'))).not.toContain('secret');
    expect(JSON.stringify(compareLineBreakText('secret\nold', 'secret\nnew'))).not.toContain('secret');
  });
});
