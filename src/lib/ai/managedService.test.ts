import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasBackendCommandsMock, clearClientSessionMock, getManagedModelsMock } = vi.hoisted(() => ({
  hasBackendCommandsMock: vi.fn(),
  clearClientSessionMock: vi.fn(),
  getManagedModelsMock: vi.fn(),
}));

vi.mock('@/lib/tauri/invoke', () => ({
  hasBackendCommands: hasBackendCommandsMock,
}));

vi.mock('@/lib/tauri/accountAuthCommands', () => ({
  accountCommands: {
    getManagedModels: getManagedModelsMock,
    getManagedBudget: vi.fn(),
    managedChatCompletion: vi.fn(),
  },
}));

vi.mock('@/lib/tauri/webAccountCommands', () => ({
  webAccountCommands: {
    clearClientSession: clearClientSessionMock,
  },
}));

describe('managedService', () => {
  beforeEach(() => {
    hasBackendCommandsMock.mockReset();
    clearClientSessionMock.mockReset();
    getManagedModelsMock.mockReset();
    vi.restoreAllMocks();
  });

  it('uses credentialed web requests for managed models', async () => {
    hasBackendCommandsMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o-mini', display_name: 'GPT-4o Mini' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels } = await import('./managedService');
    const models = await fetchManagedModels();

    expect(models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.nekotick.com/v1/models', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('clears client session when managed web auth is rejected', async () => {
    hasBackendCommandsMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels, MANAGED_AUTH_REQUIRED_ERROR } = await import('./managedService');

    await expect(fetchManagedModels()).rejects.toThrow(MANAGED_AUTH_REQUIRED_ERROR);
    expect(clearClientSessionMock).toHaveBeenCalledTimes(1);
  });

  it('keeps desktop managed model requests inside tauri commands', async () => {
    hasBackendCommandsMock.mockReturnValue(true);
    getManagedModelsMock.mockResolvedValue({
      data: [{ id: 'gpt-4o-mini' }],
    });

    const { fetchManagedModels } = await import('./managedService');
    const models = await fetchManagedModels();

    expect(models[0]?.apiModelId).toBe('gpt-4o-mini');
    expect(getManagedModelsMock).toHaveBeenCalledTimes(1);
  });
});
