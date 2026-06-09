import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferredMarkdownUpdateController } from './deferredMarkdownUpdatePlugin';

function doc(id: string): ProseNode {
  return { id } as unknown as ProseNode;
}

describe('createDeferredMarkdownUpdateController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serializes only the latest scheduled document after the debounce window', () => {
    const onMarkdownUpdated = vi.fn();
    const serializeDoc = vi.fn((value: unknown) => `markdown:${(value as { id: string }).id}`);
    const controller = createDeferredMarkdownUpdateController({
      delayMs: 120,
      onMarkdownUpdated,
      serializeDoc,
    });

    controller.schedule(doc('a'));
    vi.advanceTimersByTime(80);
    controller.schedule(doc('b'));
    vi.advanceTimersByTime(119);

    expect(serializeDoc).not.toHaveBeenCalled();
    expect(onMarkdownUpdated).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(serializeDoc).toHaveBeenCalledTimes(1);
    expect(onMarkdownUpdated).toHaveBeenCalledWith('markdown:b');
  });

  it('flushes the latest scheduled document synchronously', () => {
    const onMarkdownUpdated = vi.fn();
    const controller = createDeferredMarkdownUpdateController({
      delayMs: 120,
      onMarkdownUpdated,
      serializeDoc: (value) => `markdown:${(value as { id: string }).id}`,
    });

    controller.schedule(doc('pending'));
    controller.flush();

    expect(onMarkdownUpdated).toHaveBeenCalledTimes(1);
    expect(onMarkdownUpdated).toHaveBeenCalledWith('markdown:pending');

    vi.advanceTimersByTime(120);
    expect(onMarkdownUpdated).toHaveBeenCalledTimes(1);
  });

  it('drops pending work after destroy', () => {
    const onMarkdownUpdated = vi.fn();
    const controller = createDeferredMarkdownUpdateController({
      delayMs: 120,
      onMarkdownUpdated,
      serializeDoc: (value) => `markdown:${(value as { id: string }).id}`,
    });

    controller.schedule(doc('pending'));
    controller.destroy();
    vi.advanceTimersByTime(120);
    controller.flush();

    expect(onMarkdownUpdated).not.toHaveBeenCalled();
  });
});
