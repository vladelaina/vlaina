const CLOUD_NOTE_PREFIX = 'cloud://';

export function createCloudNoteLogicalPath(
  repositoryId: number,
  branch: string,
  relativePath: string
): string {
  const normalizedPath = relativePath.replace(/^\/+/, '');
  return `${CLOUD_NOTE_PREFIX}${repositoryId}/${encodeURIComponent(branch)}/${normalizedPath}`;
}

export function isCloudNoteLogicalPath(path: string): boolean {
  return path.startsWith(CLOUD_NOTE_PREFIX);
}

export function parseCloudNoteLogicalPath(path: string): {
  repositoryId: number;
  branch: string;
  relativePath: string;
} | null {
  if (!isCloudNoteLogicalPath(path)) return null;

  const payload = path.slice(CLOUD_NOTE_PREFIX.length);
  const firstSlash = payload.indexOf('/');
  if (firstSlash === -1) return null;

  const secondSlash = payload.indexOf('/', firstSlash + 1);
  if (secondSlash === -1) return null;

  const repositoryId = Number(payload.slice(0, firstSlash));
  if (!Number.isFinite(repositoryId)) return null;

  return {
    repositoryId,
    branch: decodeURIComponent(payload.slice(firstSlash + 1, secondSlash)),
    relativePath: payload.slice(secondSlash + 1),
  };
}
