import { describe, expect, it, vi } from 'vitest';
import {
  createDesktopWatchPayload,
  normalizeDesktopWatchOptions,
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

    await expect(createDesktopWatchPayload('change', '/vault/a.md', statPath)).resolves.toEqual({
      type: { modify: { kind: 'data', mode: 'any' } },
      paths: ['/vault/a.md'],
    });
    expect(statPath).not.toHaveBeenCalled();
  });

  it('maps rename events for existing files to create events', async () => {
    const statPath = vi.fn(async () => fileInfo(false));

    await expect(createDesktopWatchPayload('rename', '/vault/new.md', statPath)).resolves.toEqual({
      type: { create: { kind: 'file' } },
      paths: ['/vault/new.md'],
    });
  });

  it('maps rename events for existing folders to create events', async () => {
    const statPath = vi.fn(async () => fileInfo(true));

    await expect(createDesktopWatchPayload('rename', '/vault/docs', statPath)).resolves.toEqual({
      type: { create: { kind: 'folder' } },
      paths: ['/vault/docs'],
    });
  });

  it('maps rename events for missing paths to remove events', async () => {
    const statPath = vi.fn(async () => {
      throw new Error('missing');
    });

    await expect(createDesktopWatchPayload('rename', '/vault/old.md', statPath)).resolves.toEqual({
      type: { remove: { kind: 'any' } },
      paths: ['/vault/old.md'],
    });
  });
});
