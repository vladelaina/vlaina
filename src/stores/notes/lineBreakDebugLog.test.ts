import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLineBreakDebugLog,
  compareLineBreakText,
  getLineBreakDebugLogText,
  getNotesDebugLogText,
  logLineBreakDebug,
  logNotesDebug,
  setNotesDebugLoggingEnabled,
  summarizeLineBreakText,
} from './lineBreakDebugLog';

describe('lineBreakDebugLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setNotesDebugLoggingEnabled(null);
    clearLineBreakDebugLog();
  });

  it('skips debug logs by default', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logLineBreakDebug('editor:test', { lines: 3 });

    expect(debug).not.toHaveBeenCalled();
    expect(getLineBreakDebugLogText()).toBe('');
  });

  it('prints directly and keeps a copyable log buffer when enabled', () => {
    setNotesDebugLoggingEnabled(true);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logLineBreakDebug('editor:test', { lines: 3 });

    expect(debug).toHaveBeenCalledWith('[NotesLineBreak]', 'editor:test', {
      lines: 3,
    });
    expect(getLineBreakDebugLogText()).toContain('[NotesLineBreak] editor:test');
    expect(getLineBreakDebugLogText()).toContain('"lines":3');
  });

  it('keeps generic notes debug logs in the same copyable buffer', () => {
    setNotesDebugLoggingEnabled(true);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logNotesDebug('NotesAutoDraft', 'evaluate', { blockedReasons: ['has-current-note'] });

    expect(debug).toHaveBeenCalledWith('[NotesAutoDraft]', 'evaluate', {
      blockedReasons: ['has-current-note'],
    });
    expect(getNotesDebugLogText()).toContain('[NotesAutoDraft] evaluate');
    expect(getLineBreakDebugLogText()).toContain('[NotesAutoDraft] evaluate');
  });

  it('clears buffered log text', () => {
    setNotesDebugLoggingEnabled(true);
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
