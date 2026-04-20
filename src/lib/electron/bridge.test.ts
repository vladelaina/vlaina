import { afterEach, describe, expect, it } from 'vitest';
import { getElectronBridge, isElectronRuntime } from './bridge';

describe('electron bridge', () => {
  afterEach(() => {
    delete (window as Window & { vlainaDesktop?: unknown }).vlainaDesktop;
  });

  it('returns the exposed desktop bridge when present', () => {
    const bridge = {
      platform: 'electron',
      getPlatform: async () => 'electron' as const,
    } as any;

    (window as any).vlainaDesktop = bridge;

    expect(getElectronBridge()).toBe(bridge);
    expect(isElectronRuntime()).toBe(true);
  });

  it('returns null and reports non-electron runtime when no bridge is exposed', () => {
    expect(getElectronBridge()).toBeNull();
    expect(isElectronRuntime()).toBe(false);
  });
});
