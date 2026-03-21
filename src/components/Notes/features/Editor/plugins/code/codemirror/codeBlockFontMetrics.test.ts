import { describe, expect, it, vi } from 'vitest';
import { bindCodeBlockFontMetricsSync } from './codeBlockFontMetrics';

describe('codeBlockFontMetrics', () => {
  it('remeasures when document fonts become ready and detach listeners on cleanup', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const onFontMetricsChange = vi.fn();

    const cleanup = bindCodeBlockFontMetricsSync(
      {
        fonts: {
          ready: Promise.resolve(),
          addEventListener,
          removeEventListener,
        },
      } as unknown as Document,
      onFontMetricsChange
    );

    await Promise.resolve();

    expect(onFontMetricsChange).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('loadingerror', expect.any(Function));

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('loadingerror', expect.any(Function));
  });

  it('returns a no-op cleanup when document fonts API is unavailable', () => {
    const cleanup = bindCodeBlockFontMetricsSync(document.implementation.createHTMLDocument(), vi.fn());

    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});
