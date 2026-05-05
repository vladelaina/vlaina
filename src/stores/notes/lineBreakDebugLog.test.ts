import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLineBreakDebugLog,
  compareLineBreakText,
  getLineBreakDebugLogText,
  getNotesDebugLogText,
  logLineBreakDebug,
  logNotesDebug,
} from './lineBreakDebugLog';

describe('lineBreakDebugLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearLineBreakDebugLog();
  });

  it('prints directly and keeps a copyable log buffer', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    logLineBreakDebug('editor:test', { lines: 3, preview: '1\\n2\\n3' });

    expect(info).toHaveBeenCalledWith('[NotesLineBreak]', 'editor:test', {
      lines: 3,
      preview: '1\\n2\\n3',
    });
    expect(getLineBreakDebugLogText()).toContain('[NotesLineBreak] editor:test');
    expect(getLineBreakDebugLogText()).toContain('"lines":3');
  });

  it('keeps generic notes debug logs in the same copyable buffer', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    logNotesDebug('NotesAutoDraft', 'evaluate', { blockedReasons: ['has-current-note'] });

    expect(info).toHaveBeenCalledWith('[NotesAutoDraft]', 'evaluate', {
      blockedReasons: ['has-current-note'],
    });
    expect(getNotesDebugLogText()).toContain('[NotesAutoDraft] evaluate');
    expect(getLineBreakDebugLogText()).toContain('[NotesAutoDraft] evaluate');
  });

  it('clears buffered log text', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

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
});
