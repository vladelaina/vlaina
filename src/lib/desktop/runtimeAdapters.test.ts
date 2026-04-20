import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const bridge = {
    platform: 'electron' as const,
    getPlatform: vi.fn().mockResolvedValue('electron'),
    window: {
      minimize: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      confirmClose: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      setResizable: vi.fn().mockResolvedValue(undefined),
      setMaximizable: vi.fn().mockResolvedValue(undefined),
      setMinSize: vi.fn().mockResolvedValue(undefined),
      setSize: vi.fn().mockResolvedValue(undefined),
      center: vi.fn().mockResolvedValue(undefined),
      getSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
      getLabel: vi.fn().mockResolvedValue('main'),
      focus: vi.fn().mockResolvedValue(true),
      toggleFullscreen: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue(undefined),
      onCloseRequested: vi.fn(() => vi.fn()),
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
      trashItem: vi.fn().mockResolvedValue(undefined),
      revealItem: vi.fn().mockResolvedValue(undefined),
    },
    dialog: {
      open: vi.fn().mockResolvedValue('/tmp/file.md'),
      save: vi.fn().mockResolvedValue('/tmp/save.md'),
      message: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    },
    fs: {
      readBinaryFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      readTextFile: vi.fn().mockResolvedValue('hello'),
      writeBinaryFile: vi.fn().mockResolvedValue(undefined),
      writeTextFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      deleteDir: vi.fn().mockResolvedValue(undefined),
      listDir: vi.fn().mockResolvedValue([]),
      rename: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue(null),
      watch: vi.fn().mockResolvedValue(async () => undefined),
    },
    path: {
      join: vi.fn().mockResolvedValue('/tmp/a'),
      appDataDir: vi.fn().mockResolvedValue('/tmp/app'),
      toFileUrl: vi.fn().mockResolvedValue('file:///tmp/a'),
    },
    secrets: {
      getAIProviderSecrets: vi.fn().mockResolvedValue({ openai: 'secret' }),
      setAIProviderSecret: vi.fn().mockResolvedValue(undefined),
      deleteAIProviderSecret: vi.fn().mockResolvedValue(undefined),
    },
    account: {
      getSessionStatus: vi.fn().mockResolvedValue({ connected: false }),
      startAuth: vi.fn().mockResolvedValue({ success: true }),
      requestEmailCode: vi.fn().mockResolvedValue(true),
      verifyEmailCode: vi.fn().mockResolvedValue({ success: true }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      createBillingCheckout: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com' }),
      getManagedModels: vi.fn().mockResolvedValue({}),
      getManagedBudget: vi.fn().mockResolvedValue({}),
      managedChatCompletion: vi.fn().mockResolvedValue({}),
      startManagedChatCompletionStream: vi.fn().mockResolvedValue(undefined),
      cancelManagedChatCompletionStream: vi.fn().mockResolvedValue(undefined),
      onManagedStreamChunk: vi.fn(() => vi.fn()),
      onManagedStreamDone: vi.fn(() => vi.fn()),
      onManagedStreamError: vi.fn(() => vi.fn()),
    },
  };

  return {
    bridge,
    getElectronBridge: vi.fn(() => bridge),
  };
});

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

import { safeInvoke, hasBackendCommands, createDesktopBillingCheckout } from './backend';
import { openDesktopDialog, saveDesktopDialog, showDesktopConfirm, showDesktopMessage } from './dialog';
import { writeDesktopBinaryFile } from './fs';
import {
  deleteDesktopAIProviderSecret,
  getDesktopAIProviderSecrets,
  setDesktopAIProviderSecret,
} from './secrets';
import { aiProviderSecretCommands } from './secretsCommands';
import { openExternalUrl, revealItemInFolder } from './shell';
import { moveDesktopItemToTrash } from './trash';
import { watchDesktopPath } from './watch';
import { desktopWindow } from './window';

describe('desktop runtime adapters', () => {
  beforeEach(() => {
    mocks.getElectronBridge.mockReturnValue(mocks.bridge);
    for (const group of Object.values(mocks.bridge)) {
      if (group && typeof group === 'object') {
        for (const value of Object.values(group)) {
          if (typeof value === 'function' && 'mockClear' in value) {
            value.mockClear();
          }
        }
      }
    }
  });

  it('delegates window operations through the electron bridge', async () => {
    const unsubscribe = vi.fn();
    mocks.bridge.window.onCloseRequested.mockReturnValueOnce(unsubscribe);

    await desktopWindow.minimize();
    await desktopWindow.setMinSize({ width: 800, height: 600 });
    await desktopWindow.setSize({ width: 980, height: 640 });
    await desktopWindow.create({ vaultPath: '/vault', notePath: '/vault/a.md', viewMode: 'notes' });

    const size = await desktopWindow.getSize();
    const label = await desktopWindow.getLabel();
    const focused = await desktopWindow.focus('main');
    const off = desktopWindow.onCloseRequested(() => {});

    expect(mocks.bridge.window.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.window.setMinSize).toHaveBeenCalledWith(800, 600);
    expect(mocks.bridge.window.setSize).toHaveBeenCalledWith(980, 640);
    expect(mocks.bridge.window.create).toHaveBeenCalledWith({
      vaultPath: '/vault',
      notePath: '/vault/a.md',
      viewMode: 'notes',
    });
    expect(size).toEqual({ width: 1280, height: 720 });
    expect(label).toBe('main');
    expect(focused).toBe(true);
    expect(off).toBe(unsubscribe);
  });

  it('throws clear bridge errors when the window api is unavailable', async () => {
    mocks.getElectronBridge.mockReturnValue(null as never);

    await expect(Promise.resolve().then(() => desktopWindow.getSize())).rejects.toThrow(
      'Electron window bridge is not available.',
    );
  });

  it('delegates dialog, shell, trash, fs and watch helpers', async () => {
    const unwatch = vi.fn().mockResolvedValue(undefined);
    mocks.bridge.fs.watch.mockResolvedValueOnce(unwatch);

    expect(await openDesktopDialog({ title: 'Open' })).toBe('/tmp/file.md');
    expect(await saveDesktopDialog({ title: 'Save' })).toBe('/tmp/save.md');
    expect(await showDesktopConfirm('Continue?', { kind: 'warning' })).toBe(true);
    await showDesktopMessage('Saved', { title: 'Done' });
    await openExternalUrl('https://example.com');
    await revealItemInFolder('/tmp/file.md');
    await moveDesktopItemToTrash('/tmp/file.md');
    await writeDesktopBinaryFile('/tmp/file.bin', new Uint8Array([7, 8]));
    const stopWatching = await watchDesktopPath('/tmp', () => {});

    expect(mocks.bridge.dialog.open).toHaveBeenCalledWith({ title: 'Open' });
    expect(mocks.bridge.dialog.save).toHaveBeenCalledWith({ title: 'Save' });
    expect(mocks.bridge.dialog.confirm).toHaveBeenCalledWith('Continue?', { kind: 'warning' });
    expect(mocks.bridge.dialog.message).toHaveBeenCalledWith('Saved', { title: 'Done' });
    expect(mocks.bridge.shell.openExternal).toHaveBeenCalledWith('https://example.com');
    expect(mocks.bridge.shell.revealItem).toHaveBeenCalledWith('/tmp/file.md');
    expect(mocks.bridge.shell.trashItem).toHaveBeenCalledWith('/tmp/file.md');
    expect(mocks.bridge.fs.writeBinaryFile).toHaveBeenCalledWith('/tmp/file.bin', new Uint8Array([7, 8]));
    expect(mocks.bridge.fs.watch).toHaveBeenCalledWith('/tmp', expect.any(Function));

    await stopWatching();
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it('delegates secrets helpers and secret commands', async () => {
    expect(await getDesktopAIProviderSecrets(['openai'])).toEqual({ openai: 'secret' });
    await setDesktopAIProviderSecret('openai', 'sk-123');
    await deleteDesktopAIProviderSecret('openai');
    await aiProviderSecretCommands.setProviderSecret('anthropic', 'key');
    await aiProviderSecretCommands.deleteProviderSecret('anthropic');

    expect(mocks.bridge.secrets.getAIProviderSecrets).toHaveBeenCalledWith(['openai']);
    expect(mocks.bridge.secrets.setAIProviderSecret).toHaveBeenCalledWith('openai', 'sk-123');
    expect(mocks.bridge.secrets.deleteAIProviderSecret).toHaveBeenCalledWith('openai');
    expect(mocks.bridge.secrets.setAIProviderSecret).toHaveBeenCalledWith('anthropic', 'key');
    expect(mocks.bridge.secrets.deleteAIProviderSecret).toHaveBeenCalledWith('anthropic');
  });

  it('routes backend commands through electron implementations', async () => {
    expect(hasBackendCommands()).toBe(true);
    expect(await safeInvoke('open_in_system_file_manager', { path: '/tmp/file.md' })).toBeUndefined();
    expect(await safeInvoke('get_ai_provider_secrets', { providerIds: ['openai'] })).toEqual({ openai: 'secret' });
    expect(await safeInvoke('create_billing_checkout', { tier: 'pro' })).toEqual({
      success: true,
      url: 'https://example.com',
    });
    expect(await createDesktopBillingCheckout('max')).toEqual({
      success: true,
      url: 'https://example.com',
    });

    expect(mocks.bridge.shell.revealItem).toHaveBeenCalledWith('/tmp/file.md');
    expect(mocks.bridge.account.createBillingCheckout).toHaveBeenCalledWith('pro');
    expect(mocks.bridge.account.createBillingCheckout).toHaveBeenCalledWith('max');
  });

  it('handles web fallback and missing bridge errors for backend commands', async () => {
    mocks.getElectronBridge.mockReturnValue(null as never);

    expect(hasBackendCommands()).toBe(false);
    await expect(safeInvoke('missing_on_web', undefined, {
      throwOnWeb: true,
      webErrorMessage: 'desktop only',
    })).rejects.toThrow('desktop only');
    await expect(createDesktopBillingCheckout('pro')).rejects.toThrow('Electron desktop bridge is not available.');
    await expect(Promise.resolve().then(() => openDesktopDialog())).rejects.toThrow(
      'Electron dialog bridge is not available.',
    );
    await expect(Promise.resolve().then(() => openExternalUrl('https://example.com'))).rejects.toThrow(
      'Electron shell bridge is not available.',
    );
    await expect(Promise.resolve().then(() => writeDesktopBinaryFile('/tmp/file.bin', new Uint8Array()))).rejects.toThrow(
      'Electron fs bridge is not available.',
    );
    await expect(Promise.resolve().then(() => watchDesktopPath('/tmp', () => {}))).rejects.toThrow(
      'Electron fs bridge is not available.',
    );

    expect(await safeInvoke('noop', undefined, { webFallback: 'fallback' })).toBe('fallback');
  });

  it('rejects unsupported backend commands even on desktop', async () => {
    await expect(safeInvoke('unsupported_command')).rejects.toThrow('Unsupported desktop command: unsupported_command');
  });
});
