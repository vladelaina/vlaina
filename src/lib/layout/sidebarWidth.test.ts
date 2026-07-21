import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultSidebarWidth } from './sidebarWidth';

describe('getDefaultSidebarWidth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses 28 percent of the viewport width', () => {
    vi.stubGlobal('innerWidth', 1280);

    expect(getDefaultSidebarWidth()).toBe(358);
  });

  it('keeps the viewport-based default between 280 and 420 pixels', () => {
    vi.stubGlobal('innerWidth', 500);
    expect(getDefaultSidebarWidth()).toBe(280);

    vi.stubGlobal('innerWidth', 3000);
    expect(getDefaultSidebarWidth()).toBe(420);
  });
});
