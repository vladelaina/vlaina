import { getParentPath, isAbsolutePath, normalizePath, relativePath } from '@/lib/storage/adapter';

export interface FolderSegment {
  label: string;
  fullPath: string;
}

export interface BreadcrumbDisplayPath {
  rootLabel: string;
  rootPath: string;
  displayPath: string;
  isAbsolute: boolean;
}

function toRelativePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function compressHomePath(path: string, homePath: string | null): string {
  if (!homePath) {
    return path;
  }

  const normalizedPath = toRelativePath(path);
  const normalizedHome = toRelativePath(homePath).replace(/\/+$/, '');
  if (normalizedPath === normalizedHome) {
    return '~';
  }
  if (normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~/${normalizedPath.slice(normalizedHome.length + 1)}`;
  }

  return path;
}

export function resolveDisplayPath(
  notePath: string,
  notesPath: string | undefined,
  notesRootName: string,
  homePath: string | null
): BreadcrumbDisplayPath {
  const normalizedNote = toRelativePath(notePath);
  if (isAbsolutePath(notePath)) {
    const compressedPath = compressHomePath(normalizedNote, homePath);
    const isHomeRelative = compressedPath === '~' || compressedPath.startsWith('~/');
    const rootLabel = isHomeRelative
      ? '~'
      : /^[a-zA-Z]:\//.test(compressedPath)
        ? compressedPath.slice(0, 2)
        : '/';
    const rootPath = isHomeRelative
      ? homePath ?? getParentPath(normalizedNote) ?? normalizedNote
      : rootLabel === '/'
        ? '/'
        : `${rootLabel}/`;
    const displayPath = isHomeRelative
      ? compressedPath === '~'
        ? ''
        : compressedPath.slice(2)
      : rootLabel === '/'
        ? compressedPath.replace(/^\/+/, '')
        : compressedPath.slice(rootLabel.length).replace(/^\/+/, '');

    return {
      rootLabel,
      rootPath,
      displayPath,
      isAbsolute: true,
    };
  }

  if (!notesPath) {
    return {
      rootLabel: notesRootName,
      rootPath: '',
      displayPath: normalizedNote,
      isAbsolute: false,
    };
  }

  const normalizedBase = toRelativePath(notesPath).replace(/\/+$/, '');
  if (normalizedNote === normalizedBase) {
    return { rootLabel: notesRootName, rootPath: '', displayPath: '', isAbsolute: false };
  }
  if (normalizedNote.startsWith(`${normalizedBase}/`)) {
    return {
      rootLabel: notesRootName,
      rootPath: '',
      displayPath: normalizedNote.slice(normalizedBase.length + 1),
      isAbsolute: false,
    };
  }
  return {
    rootLabel: notesRootName,
    rootPath: '',
    displayPath: normalizedNote,
    isAbsolute: false,
  };
}

function expandDisplayPath(displayPath: string, homePath: string | null): string {
  if (displayPath === '~') {
    return homePath ?? displayPath;
  }
  if (displayPath.startsWith('~/')) {
    return homePath ? `${homePath.replace(/\/+$/, '')}/${displayPath.slice(2)}` : displayPath;
  }
  return displayPath;
}

export function resolveNotePathWithinDirectory(notePath: string, directoryPath: string): string | null {
  const normalizedNote = normalizePath(notePath, true);
  const normalizedRawDirectory = normalizePath(directoryPath, true);
  const normalizedDirectory = normalizedRawDirectory === '/'
    ? '/'
    : normalizedRawDirectory.replace(/\/+$/, '');

  if (!normalizedDirectory || normalizedNote === normalizedDirectory) {
    return null;
  }

  const directoryPrefix = normalizedDirectory === '/' ? '/' : `${normalizedDirectory}/`;
  if (!normalizedNote.startsWith(directoryPrefix)) {
    return null;
  }

  return relativePath(normalizedDirectory, normalizedNote);
}

export function buildFolderSegments(
  displayPath: string,
  isAbsolute: boolean,
  rootPath: string,
  homePath: string | null
): FolderSegment[] {
  const relativePath = toRelativePath(displayPath);
  const parts = relativePath.split('/').filter(Boolean);
  const folderParts = parts.slice(0, -1);

  return folderParts.map((label, index) => ({
    label,
    fullPath: isAbsolute
      ? expandDisplayPath(`${rootPath.replace(/\/+$/, '')}/${folderParts.slice(0, index + 1).join('/')}`, homePath)
      : folderParts.slice(0, index + 1).join('/'),
  }));
}
