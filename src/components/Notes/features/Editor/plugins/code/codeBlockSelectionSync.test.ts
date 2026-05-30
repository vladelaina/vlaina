import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CODE_BLOCK_SELECTION_SYNC_EVENT,
  requestCodeBlockSelectionSync,
  subscribeCodeBlockSelectionSync,
} from './codeBlockSelectionSync';

describe('codeBlockSelectionSync', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    vi.restoreAllMocks();
  });

  it('uses one document selectionchange listener for multiple subscribers', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const first = vi.fn();
    const second = vi.fn();

    cleanups.push(subscribeCodeBlockSelectionSync(document, first));
    cleanups.push(subscribeCodeBlockSelectionSync(document, second));

    expect(addSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith(CODE_BLOCK_SELECTION_SYNC_EVENT, expect.any(Function));

    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    cleanups.pop()?.();
    expect(removeSpy).not.toHaveBeenCalled();

    cleanups.pop()?.();
    expect(removeSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(CODE_BLOCK_SELECTION_SYNC_EVENT, expect.any(Function));
  });

  it('syncs subscribers when an editor programmatically collapses selection', async () => {
    const callback = vi.fn();
    cleanups.push(subscribeCodeBlockSelectionSync(document, callback));

    requestCodeBlockSelectionSync(document);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
