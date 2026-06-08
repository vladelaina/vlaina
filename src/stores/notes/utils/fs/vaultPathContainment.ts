import { isAbsolutePath, joinPath } from '@/lib/storage/adapter';

const UNSAFE_VAULT_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function isSafeVaultPathSegment(segment: string | undefined): segment is string {
  return (
    !!segment &&
    segment !== '.' &&
    segment !== '..' &&
    !UNSAFE_VAULT_PATH_CHARS.test(segment) &&
    !/[\\/]/.test(segment)
  );
}

export function normalizeVaultRelativePath(
  path: string | undefined,
  options: { allowEmpty?: boolean } = {},
): string | null {
  if (path == null) {
    return options.allowEmpty ? '' : null;
  }

  const normalized = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (isAbsolutePath(normalized) || normalized.startsWith('/')) {
    return null;
  }

  const parts: string[] = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..' || UNSAFE_VAULT_PATH_CHARS.test(part)) {
      return null;
    }
    parts.push(part);
  }

  if (parts.length === 0) {
    return options.allowEmpty ? '' : null;
  }

  return parts.join('/');
}

export async function resolveVaultRelativeFullPath(
  vaultPath: string,
  path: string,
  options: { allowEmpty?: boolean; errorMessage?: string } = {},
): Promise<{ relativePath: string; fullPath: string }> {
  const relativePath = normalizeVaultRelativePath(path, options);
  if (relativePath == null) {
    throw new Error(options.errorMessage ?? 'Path must stay inside the current vault.');
  }

  return {
    relativePath,
    fullPath: relativePath ? await joinPath(vaultPath, relativePath) : vaultPath,
  };
}
