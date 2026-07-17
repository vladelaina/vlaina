import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushCurrentEditorSave, registerCurrentEditorSaveFlusher } from './editorSaveRegistry';

describe('editorSaveRegistry', () => {
  afterEach(async () => {
    registerCurrentEditorSaveFlusher(() => undefined)();
    await flushCurrentEditorSave();
  });

  it('flushes the current editor save queue', async () => {
    const flush = vi.fn(async () => undefined);

    registerCurrentEditorSaveFlusher(flush);
    await flushCurrentEditorSave();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest registered editor active', async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const unregisterFirst = registerCurrentEditorSaveFlusher(first);

    registerCurrentEditorSaveFlusher(second);
    unregisterFirst();
    await flushCurrentEditorSave();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
