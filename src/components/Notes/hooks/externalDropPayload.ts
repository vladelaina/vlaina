import { getElectronBridge } from '@/lib/electron/bridge';

export const MAX_EXTERNAL_DROP_FILE_SCAN = 2000;
export const MAX_EXTERNAL_DROP_TYPE_SCAN = 1024;
export const MAX_EXTERNAL_DROP_PATH_CHARS = 64 * 1024;

type ExternalDropArrayLike<T> = ArrayLike<T> & {
  item?: (index: number) => T | null;
};

function getArrayLikeLength(value: { length?: number } | null | undefined): number {
  return typeof value?.length === 'number' && Number.isFinite(value.length) && value.length > 0
    ? Math.floor(value.length)
    : 0;
}

function getFileAt(files: ExternalDropArrayLike<File>, index: number): File | null {
  if (typeof files.item === 'function') {
    return files.item(index);
  }
  return (files as unknown as ArrayLike<File>)[index] ?? null;
}

function getTypeAt(types: ExternalDropArrayLike<string>, index: number): string | null {
  if (typeof types.item === 'function') {
    return types.item(index);
  }
  return types[index] ?? null;
}

function normalizeExternalDropPath(value: string | undefined): string | null {
  if (!value || value.length > MAX_EXTERNAL_DROP_PATH_CHARS) {
    return null;
  }

  const path = value.trim();
  return path ? path : null;
}

export function getDroppedExternalPaths(dataTransfer: DataTransfer | null | undefined): string[] {
  const files = dataTransfer?.files as ExternalDropArrayLike<File> | null | undefined;
  const fileCount = getArrayLikeLength(files);
  if (!files || fileCount === 0) return [];

  const dragDrop = getElectronBridge()?.dragDrop;
  const paths: string[] = [];
  const scanCount = Math.min(fileCount, MAX_EXTERNAL_DROP_FILE_SCAN);
  for (let index = 0; index < scanCount; index += 1) {
    const file = getFileAt(files, index);
    if (!file) continue;

    const legacyPath = normalizeExternalDropPath((file as File & { path?: string }).path);
    if (legacyPath) {
      paths.push(legacyPath);
      continue;
    }

    try {
      const path = normalizeExternalDropPath(dragDrop?.getPathForFile(file));
      if (path) paths.push(path);
    } catch {
      // Ignore unreadable drag entries.
    }
  }

  return paths;
}

export function hasDataTransferType(
  types: ExternalDropArrayLike<string> | null | undefined,
  targetType: string,
): boolean {
  const typeCount = getArrayLikeLength(types);
  if (!types || typeCount === 0 || typeCount > MAX_EXTERNAL_DROP_TYPE_SCAN) {
    return false;
  }

  for (let index = 0; index < typeCount; index += 1) {
    if (getTypeAt(types, index) === targetType) {
      return true;
    }
  }
  return false;
}

export function hasExternalDroppedFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  return getArrayLikeLength(dataTransfer?.files) > 0 || hasDataTransferType(dataTransfer?.types, 'Files');
}
