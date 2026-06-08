const INTERNAL_NOTE_ASSET_PATH_SEGMENTS = new Set(['.vlaina', '.git']);
const MAX_INTERNAL_NOTE_ASSET_URL_DECODE_DEPTH = 3;

function decodeUrlPathCandidate(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

export function hasInternalNoteAssetPathSegment(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  return path
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => INTERNAL_NOTE_ASSET_PATH_SEGMENTS.has(segment.toLowerCase()));
}

export function hasInternalNoteAssetUrlPathSegment(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  let pathCandidate = path.split(/[?#]/, 1)[0] ?? '';
  for (let depth = 0; depth < MAX_INTERNAL_NOTE_ASSET_URL_DECODE_DEPTH; depth += 1) {
    if (hasInternalNoteAssetPathSegment(pathCandidate)) {
      return true;
    }

    const decoded = decodeUrlPathCandidate(pathCandidate);
    if (!decoded || decoded === pathCandidate) {
      return false;
    }
    pathCandidate = decoded;
  }

  return hasInternalNoteAssetPathSegment(pathCandidate);
}
