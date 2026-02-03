export function toStoragePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function toOSPath(path: string, separator: string): string {
  if (separator === '/') {
    return path;
  }
  return path.replace(/\//g, separator);
}

export function isRelativePath(path: string): boolean {
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }

  if (path.startsWith('/')) {
    return false;
  }

  if (path.startsWith('\\\\')) {
    return false;
  }

  return true;
}

export function isValidAssetFilename(filename: string): boolean {
  if (filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  if (!filename.includes('.')) {
    return false;
  }
  return true;
}

export function buildAssetPath(filename: string): string {
  if (filename.startsWith('icons/')) {
    return `.nekotick/assets/${filename}`;
  }
  return `.nekotick/assets/covers/${filename}`;
}

export function buildFullAssetPath(vaultPath: string, assetFilename: string): string {
  const sep = vaultPath.includes('\\') ? '\\' : '/';

  const isIcon = assetFilename.startsWith('icons/') || assetFilename.startsWith('icons\\');
  const normalizedFilename = assetFilename.replace(/\//g, sep);
  
  if (isIcon) {
    return `${vaultPath}${sep}.nekotick${sep}assets${sep}${normalizedFilename}`;
  }

  return `${vaultPath}${sep}.nekotick${sep}assets${sep}covers${sep}${normalizedFilename}`;
}
