import { APP_CONFIG_FOLDER } from '../../constants';

const INTERNAL_NOTE_PATH_SEGMENTS = new Set([APP_CONFIG_FOLDER, '.git']);

export function hasInternalNotePathSegment(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  return path
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => INTERNAL_NOTE_PATH_SEGMENTS.has(segment));
}

export function assertNonInternalNotePath(path: string, errorMessage = 'Path must not be inside an internal notes folder.'): void {
  if (hasInternalNotePathSegment(path)) {
    throw new Error(errorMessage);
  }
}
