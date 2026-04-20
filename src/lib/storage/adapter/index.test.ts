import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  electronJoin: vi.fn().mockResolvedValue('C:\\data\\vlaina'),
  electronCtor: vi.fn(),
  webCtor: vi.fn(),
}));

vi.mock('./ElectronAdapter', () => ({
  ElectronAdapter: class MockElectronAdapter {
    constructor() {
      mocks.electronCtor();
    }
  },
}));

vi.mock('./WebAdapter', () => ({
  WebAdapter: class MockWebAdapter {
    constructor() {
      mocks.webCtor();
    }
  },
}));

import { getPlatform, getStorageAdapter, isElectron, isWeb, joinPath, resetStorageAdapter } from './index';

describe('storage adapter index', () => {
  beforeEach(() => {
    resetStorageAdapter();
    mocks.electronCtor.mockClear();
    mocks.webCtor.mockClear();
    mocks.electronJoin.mockClear();
    delete (window as any).__VL_ELECTRON__;
    delete (window as any).vlainaDesktop;
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  it('uses the web platform and adapter by default', () => {
    expect(getPlatform()).toBe('web');
    expect(isWeb()).toBe(true);
    expect(isElectron()).toBe(false);

    const adapter = getStorageAdapter();
    expect(adapter).toBeInstanceOf(Object);
    expect(mocks.webCtor).toHaveBeenCalledTimes(1);
    expect(mocks.electronCtor).not.toHaveBeenCalled();
  });

  it('uses the electron platform and caches the adapter instance when the bridge exists', () => {
    (window as any).__VL_ELECTRON__ = { platform: 'electron' };

    expect(getPlatform()).toBe('electron');
    expect(isElectron()).toBe(true);

    const first = getStorageAdapter();
    const second = getStorageAdapter();

    expect(first).toBe(second);
    expect(mocks.electronCtor).toHaveBeenCalledTimes(1);
    expect(mocks.webCtor).not.toHaveBeenCalled();
  });

  it('routes joinPath through the electron path bridge in electron runtime', async () => {
    (window as any).vlainaDesktop = {
      path: {
        join: mocks.electronJoin,
      },
    };

    await expect(joinPath('C:\\data', 'vlaina')).resolves.toBe('C:\\data\\vlaina');
    expect(mocks.electronJoin).toHaveBeenCalledWith('C:\\data', 'vlaina');
  });

  it('falls back to simple path joining on web', async () => {
    await expect(joinPath('/data', 'vlaina', 'chat')).resolves.toBe('/data/vlaina/chat');
  });
});
