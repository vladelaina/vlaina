import type { WatchEvent } from '@tauri-apps/plugin-fs';
import { describe, expect, it } from 'vitest';
import {
  getRelativeRenameWatchPaths,
  getRelevantRelativeWatchPaths,
  isIgnoredWatchPath,
  isInsideVault,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';

describe('notesExternalSyncUtils', () => {
  it('normalizes filesystem separators', () => {
    expect(normalizeFsPath('C:\\vault\\docs\\alpha.md')).toBe('C:/vault/docs/alpha.md');
  });

  it('resolves relative vault paths for files inside the vault', () => {
    expect(toVaultRelativePath('C:/vault', 'C:/vault/docs/alpha.md')).toBe('docs/alpha.md');
  });

  it('returns null for paths outside the vault', () => {
    expect(toVaultRelativePath('C:/vault', 'C:/other/docs/alpha.md')).toBeNull();
    expect(isInsideVault('C:/vault', 'C:/other/docs/alpha.md')).toBe(false);
  });

  it('ignores internal app config files and temp writes', () => {
    expect(isIgnoredWatchPath('.vlaina/store/metadata.json')).toBe(true);
    expect(isIgnoredWatchPath('docs/alpha.md.123.tmp')).toBe(true);
    expect(isIgnoredWatchPath('docs/alpha.md')).toBe(false);
  });

  it('detects markdown note files', () => {
    expect(isMarkdownPath('docs/alpha.md')).toBe(true);
    expect(isMarkdownPath('docs/alpha.MD')).toBe(true);
    expect(isMarkdownPath('docs/assets')).toBe(false);
  });

  it('collects relevant relative watch paths and skips ignored entries', () => {
    expect(
      getRelevantRelativeWatchPaths('C:/vault', [
        'C:/vault/docs/alpha.md',
        'C:/vault/.vlaina/store/metadata.json',
        'C:/vault/docs/alpha.md',
        'C:/outside/beta.md',
        'C:/vault/docs/alpha.md.123.tmp',
      ])
    ).toEqual(['docs/alpha.md']);
  });

  it('extracts old and new relative paths for rename events', () => {
    const renameEvent = {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:/vault/docs/alpha.md', 'C:/vault/archive/beta.md'],
      attrs: null,
    } satisfies WatchEvent;

    expect(getRelativeRenameWatchPaths('C:/vault', renameEvent)).toEqual({
      oldPath: 'docs/alpha.md',
      newPath: 'archive/beta.md',
    });
  });

  it('treats rename-to-outside as a deletion and rename-from-outside as a create', () => {
    const moveOutEvent = {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:/vault/docs/alpha.md', 'C:/outside/alpha.md'],
      attrs: null,
    } satisfies WatchEvent;
    const moveInEvent = {
      type: { modify: { kind: 'rename', mode: 'to' } },
      paths: ['C:/vault/docs/alpha.md'],
      attrs: null,
    } satisfies WatchEvent;

    expect(getRelativeRenameWatchPaths('C:/vault', moveOutEvent)).toEqual({
      oldPath: 'docs/alpha.md',
      newPath: null,
    });
    expect(getRelativeRenameWatchPaths('C:/vault', moveInEvent)).toEqual({
      oldPath: null,
      newPath: 'docs/alpha.md',
    });
  });

  it('detects remove events', () => {
    expect(
      isRemoveWatchEvent({
        type: { remove: { kind: 'file' } },
      } as Pick<WatchEvent, 'type'>)
    ).toBe(true);
    expect(
      isRemoveWatchEvent({
        type: { modify: { kind: 'data', mode: 'content' } },
      } as Pick<WatchEvent, 'type'>)
    ).toBe(false);
  });
});
