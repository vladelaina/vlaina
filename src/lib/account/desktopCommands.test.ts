import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './sessionEvent';

const mocks = vi.hoisted(() => {
  const account = {
    getSessionStatus: vi.fn().mockResolvedValue({
      connected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: 'Pro',
    }),
    startAuth: vi.fn().mockResolvedValue({ success: true, provider: 'google', error: null }),
    requestEmailCode: vi.fn().mockResolvedValue(true),
    verifyEmailCode: vi.fn().mockResolvedValue({ success: true, provider: 'email', error: null }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    createBillingCheckout: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com' }),
    getManagedModels: vi.fn().mockResolvedValue({ data: [] }),
    getManagedBudget: vi.fn().mockResolvedValue({ active: true }),
    managedChatCompletion: vi.fn().mockResolvedValue({ id: 'resp-1' }),
    startManagedChatCompletionStream: vi.fn().mockResolvedValue(undefined),
    cancelManagedChatCompletionStream: vi.fn().mockResolvedValue(undefined),
    onManagedStreamChunk: vi.fn(),
    onManagedStreamDone: vi.fn(),
    onManagedStreamError: vi.fn(),
  };

  return {
    getElectronBridge: vi.fn(() => ({ account })),
    account,
  };
});

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

import { accountCommands } from './desktopCommands';

describe('desktop account commands', () => {
  beforeEach(() => {
    mocks.getElectronBridge.mockReturnValue({ account: mocks.account });
    for (const value of Object.values(mocks.account)) {
      if (typeof value === 'function' && 'mockClear' in value) {
        value.mockClear();
      }
    }
  });

  it('delegates account status and auth methods to the electron bridge', async () => {
    expect(await accountCommands.getAccountSessionStatus()).toMatchObject({
      connected: true,
      provider: 'google',
    });

    await accountCommands.accountAuth('google');
    await accountCommands.requestEmailAuthCode('vla@example.com');
    await accountCommands.verifyEmailAuthCode('vla@example.com', '123456');

    expect(mocks.account.startAuth).toHaveBeenCalledWith('google');
    expect(mocks.account.requestEmailCode).toHaveBeenCalledWith('vla@example.com');
    expect(mocks.account.verifyEmailCode).toHaveBeenCalledWith('vla@example.com', '123456');
  });

  it('dispatches auth invalidation when managed calls fail with sign-in required', async () => {
    const invalidated = vi.fn();
    window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, invalidated, { once: true });
    mocks.account.getManagedBudget.mockRejectedValueOnce(new Error('vlaina sign-in required'));

    await expect(accountCommands.getManagedBudget()).rejects.toThrow('vlaina sign-in required');

    expect(invalidated).toHaveBeenCalledTimes(1);
  });

  it('disconnects and dispatches auth invalidation', async () => {
    const invalidated = vi.fn();
    window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, invalidated, { once: true });

    await accountCommands.accountDisconnect();

    expect(mocks.account.disconnect).toHaveBeenCalledTimes(1);
    expect(invalidated).toHaveBeenCalledTimes(1);
  });

  it('streams managed completions through bridge events', async () => {
    const listeners: Record<string, ((payload: any) => void) | undefined> = {};
    mocks.account.onManagedStreamChunk.mockImplementation((_requestId: string, callback: (content: string) => void) => {
      listeners.chunk = callback;
      return vi.fn();
    });
    mocks.account.onManagedStreamDone.mockImplementation((_requestId: string, callback: (payload: { content: string }) => void) => {
      listeners.done = callback;
      return vi.fn();
    });
    mocks.account.onManagedStreamError.mockImplementation((_requestId: string, callback: (payload: { message: string }) => void) => {
      listeners.error = callback;
      return vi.fn();
    });
    mocks.account.startManagedChatCompletionStream.mockImplementationOnce(async () => {
      listeners.chunk?.('hello');
      listeners.done?.({ content: 'hello world' });
    });

    const onChunk = vi.fn();
    const result = await accountCommands.managedChatCompletionStream(
      { model: 'vlaina-managed/test' },
      onChunk,
      undefined,
      'req-1',
    );

    expect(mocks.account.startManagedChatCompletionStream).toHaveBeenCalledWith('req-1', { model: 'vlaina-managed/test' });
    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(result).toBe('hello world');
  });

  it('cancels managed streams when the signal aborts', async () => {
    const listeners: Record<string, ((payload: any) => void) | undefined> = {};
    mocks.account.onManagedStreamChunk.mockImplementation((_requestId: string, callback: (content: string) => void) => {
      listeners.chunk = callback;
      return vi.fn();
    });
    mocks.account.onManagedStreamDone.mockImplementation((_requestId: string, callback: (payload: { content: string }) => void) => {
      listeners.done = callback;
      return vi.fn();
    });
    mocks.account.onManagedStreamError.mockImplementation((_requestId: string, callback: (payload: { message: string }) => void) => {
      listeners.error = callback;
      return vi.fn();
    });
    mocks.account.startManagedChatCompletionStream.mockImplementationOnce(async () => {
      return new Promise<void>(() => {});
    });

    const controller = new AbortController();
    const streamPromise = accountCommands.managedChatCompletionStream(
      { model: 'vlaina-managed/test' },
      vi.fn(),
      controller.signal,
      'req-abort',
    );

    controller.abort();
    listeners.error?.({ message: 'Aborted' });

    await expect(streamPromise).rejects.toThrow('Aborted');
    expect(mocks.account.cancelManagedChatCompletionStream).toHaveBeenCalledWith('req-abort');
  });

  it('throws a clear error when the electron bridge is unavailable', async () => {
    mocks.getElectronBridge.mockReturnValue(null as never);

    await expect(accountCommands.getAccountSessionStatus()).rejects.toThrow(
      'Electron desktop bridge is not available.',
    );
  });
});
