import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeCodeBlockSelectionSync } from './codeBlockSelectionSync';

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

    expect(addSpy).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    cleanups.pop()?.();
    expect(removeSpy).not.toHaveBeenCalled();

    cleanups.pop()?.();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
