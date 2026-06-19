// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

async function importOpenTargetEvents() {
  vi.resetModules();
  return import('./openTargetEvents');
}

describe('openTargetEvents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers markdown targets that arrive before a subscriber is registered', async () => {
    const { subscribeOpenMarkdownTargetEvent } = await importOpenTargetEvents();
    const listener = vi.fn();

    window.dispatchEvent(new CustomEvent('app-open-markdown-target', {
      detail: '/vault/early.md',
    }));

    const unsubscribe = subscribeOpenMarkdownTargetEvent(listener);

    expect(listener).toHaveBeenCalledWith('/vault/early.md');
    unsubscribe();
  });

  it('delivers dispatched markdown targets to active subscribers once', async () => {
    const {
      dispatchOpenMarkdownTargetEvent,
      subscribeOpenMarkdownTargetEvent,
    } = await importOpenTargetEvents();
    const listener = vi.fn();
    const unsubscribe = subscribeOpenMarkdownTargetEvent(listener);

    dispatchOpenMarkdownTargetEvent('/vault/live.md');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('/vault/live.md');
    unsubscribe();
  });
});
