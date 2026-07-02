import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDesktopWatchPayload,
  isPathCoveredByWatchPath,
  MAX_DESKTOP_WATCH_GROUP_SUBSCRIBERS,
  normalizeDesktopWatchOptions,
  registerDesktopWatchIpc,
} from '../../electron/desktopWatchIpc.mjs';

function fileInfo(isDirectory = false) {
  return {
    isDirectory: () => isDirectory,
  };
}

describe('desktop watch ipc payload mapping', () => {
  it('defaults watches to recursive and allows non-recursive parent watches', () => {
    expect(normalizeDesktopWatchOptions(undefined)).toEqual({ recursive: true });
    expect(normalizeDesktopWatchOptions({ recursive: true })).toEqual({ recursive: true });
    expect(normalizeDesktopWatchOptions({ recursive: false })).toEqual({ recursive: false });
  });

  it('maps data changes to modify events without stat calls', async () => {
    const statPath = vi.fn();

    await expect(createDesktopWatchPayload('change', '/notesRoot/a.md', statPath)).resolves.toEqual({
      type: { modify: { kind: 'data', mode: 'any' } },
      paths: ['/notesRoot/a.md'],
    });
    expect(statPath).not.toHaveBeenCalled();
  });

  it('drops unsafe or oversized watch event paths before statting', async () => {
    const statPath = vi.fn();

    await expect(createDesktopWatchPayload('change', `/notesRoot/${'x'.repeat(8193)}.md`, statPath))
      .resolves.toBeNull();
    await expect(createDesktopWatchPayload('rename', '/notesRoot/bad\u202E.md', statPath))
      .resolves.toBeNull();
    expect(statPath).not.toHaveBeenCalled();
  });

  it('maps rename events for existing files to create events', async () => {
    const statPath = vi.fn(async () => fileInfo(false));

    await expect(createDesktopWatchPayload('rename', '/notesRoot/new.md', statPath)).resolves.toEqual({
      type: { create: { kind: 'file' } },
      paths: ['/notesRoot/new.md'],
    });
  });

  it('maps rename events for existing folders to create events', async () => {
    const statPath = vi.fn(async () => fileInfo(true));

    await expect(createDesktopWatchPayload('rename', '/notesRoot/docs', statPath)).resolves.toEqual({
      type: { create: { kind: 'folder' } },
      paths: ['/notesRoot/docs'],
    });
  });

  it('maps rename events for missing paths to remove events', async () => {
    const statPath = vi.fn(async () => {
      throw new Error('missing');
    });

    await expect(createDesktopWatchPayload('rename', '/notesRoot/old.md', statPath)).resolves.toEqual({
      type: { remove: { kind: 'any' } },
      paths: ['/notesRoot/old.md'],
    });
  });

  it('matches synthetic rename notifications to recursive and direct child watchers', () => {
    expect(isPathCoveredByWatchPath('/notesRoot', '/notesRoot/docs/a.md', true)).toBe(true);
    expect(isPathCoveredByWatchPath('/notesRoot', '/notesRoot/docs/a.md', false)).toBe(false);
    expect(isPathCoveredByWatchPath('/notesRoot/docs', '/notesRoot/docs/a.md', false)).toBe(true);
    expect(isPathCoveredByWatchPath('/notesRoot/docs', '/notesRoot/other/a.md', true)).toBe(false);
  });

  it('treats a recursive root watcher as covering absolute descendants', () => {
    expect(isPathCoveredByWatchPath('/', '/notesRoot/docs/a.md', true)).toBe(true);
    expect(isPathCoveredByWatchPath('/', '/notesRoot/docs/a.md', false)).toBe(false);
  });

  it('bounds repeated subscribers for one desktop watcher group', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vlaina-watch-'));
    const handlers = new Map<string, (...args: any[]) => unknown>();
    registerDesktopWatchIpc({
      handleIpc: (channel, handler) => handlers.set(channel, handler),
      requireNonEmptyString: (value, label) => {
        const normalized = String(value ?? '').trim();
        if (!normalized) throw new Error(`${label} is required`);
        return normalized;
      },
      assertAuthorizedFsWatchPath: async (watchPath) => String(watchPath),
    });
    const sender = { isDestroyed: () => false, send: vi.fn() };
    const watchIds: string[] = [];

    try {
      for (let index = 0; index < MAX_DESKTOP_WATCH_GROUP_SUBSCRIBERS; index += 1) {
        const watchId = await handlers.get('desktop:fs:watch')?.(
          { sender },
          tempDir,
          { recursive: false },
        );
        watchIds.push(String(watchId));
      }

      await expect(handlers.get('desktop:fs:watch')?.(
        { sender },
        tempDir,
        { recursive: false },
      )).rejects.toThrow('Too many desktop filesystem watcher subscribers.');
    } finally {
      for (const watchId of watchIds) {
        await handlers.get('desktop:fs:unwatch')?.({}, watchId);
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
