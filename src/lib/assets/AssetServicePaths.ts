import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from './core/pathContainment';
import { hasInternalNoteAssetPathSegment } from './core/internalAssetPaths';
import { hasUnsafeNotesRootPathSegment, isSafeNotesRootPathSegment } from '@/stores/notes/utils/fs/notesRootPathContainment';
import type { AssetConfig, AssetContext } from './AssetServiceTypes';

function normalizeSafeSubfolderName(name: string | undefined, fallback: string): string {
  const normalized = (name || fallback).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (
    parts.length === 0 ||
    parts.some((part) => !isSafeNotesRootPathSegment(part)) ||
    hasInternalNoteAssetPathSegment(parts.join('/'))
  ) {
    return fallback;
  }

  return parts.join('/');
}

function hasUnsafeCurrentNotePathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path, {
    allowNavigationSegments: true,
  });
}

async function resolveContainedTargetDir(rootPath: string, subfolderName: string): Promise<string> {
  const candidate = normalizeContainedAssetPath(await joinPath(rootPath, subfolderName), rootPath);
  if (!candidate) {
    throw new Error('Asset target folder must stay inside the current note location.');
  }

  return candidate;
}

async function resolveCurrentNoteDir(notesRootPath: string, currentNotePath: string): Promise<string> {
  if (hasInternalNoteAssetPathSegment(currentNotePath)) {
    throw new Error('Current note path must not be inside an internal notes folder.');
  }
  if (hasUnsafeCurrentNotePathSegment(currentNotePath)) {
    throw new Error('Current note path contains unsupported characters.');
  }

  if (isAbsolutePath(currentNotePath)) {
    return getParentPath(currentNotePath) || notesRootPath;
  }

  const absoluteNotePath = normalizeContainedAssetPath(await joinPath(notesRootPath, currentNotePath), notesRootPath);
  if (!absoluteNotePath) {
    throw new Error('Current note path must stay inside the opened folder.');
  }

  return getParentPath(absoluteNotePath) || notesRootPath;
}

export async function resolveAssetTarget(
  context: AssetContext,
  config: AssetConfig,
): Promise<{ targetDir: string; storedPathPrefix: string }> {
  const { notesRootPath, currentNotePath } = context;

  switch (config.storageMode) {
    case 'notesRoot':
    default:
      return {
        targetDir: notesRootPath,
        storedPathPrefix: ''
      };

    case 'notesRootSubfolder': {
      const notesRootSubfolderName = normalizeSafeSubfolderName(config.imageNotesRootSubfolderName, 'assets');
      return {
        targetDir: await resolveContainedTargetDir(notesRootPath, notesRootSubfolderName),
        storedPathPrefix: `${notesRootSubfolderName}/`
      };
    }

    case 'currentFolder':
      if (currentNotePath) {
        const currentDir = await resolveCurrentNoteDir(notesRootPath, currentNotePath);

        return {
          targetDir: currentDir,
          storedPathPrefix: './'
        };
      }
      return {
        targetDir: notesRootPath,
        storedPathPrefix: ''
      };

    case 'subfolder':
      if (currentNotePath) {
        const noteDir = await resolveCurrentNoteDir(notesRootPath, currentNotePath);
        const subfolderName = normalizeSafeSubfolderName(config.subfolderName, 'assets');

        return {
          targetDir: await resolveContainedTargetDir(noteDir, subfolderName),
          storedPathPrefix: `./${subfolderName}/`
        };
      }
      return {
        targetDir: notesRootPath,
        storedPathPrefix: ''
      };
  }
}
