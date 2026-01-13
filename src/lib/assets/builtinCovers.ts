/**
 * Built-in cover images bundled with the app
 * These are loaded from public/covers/ directory
 */

export interface BuiltinCover {
  /** Short ID for storage, e.g. "monet/1" */
  id: string;
  /** Full path in public/covers/, e.g. "Claude Monet/1.webp" */
  path: string;
}

// Built-in covers list
const BUILTIN_COVERS: BuiltinCover[] = [
  // Claude Monet
  { id: 'monet/1', path: 'Claude Monet/1.webp' },
  { id: 'monet/2', path: 'Claude Monet/2.webp' },
  { id: 'monet/3', path: 'Claude Monet/3.webp' },
  { id: 'monet/4', path: 'Claude Monet/4.webp' },
  { id: 'monet/5', path: 'Claude Monet/5.webp' },
  // Henri Biva
  { id: 'biva/1', path: 'Henri Biva/1.webp' },
  { id: 'biva/2', path: 'Henri Biva/2.webp' },
  { id: 'biva/3', path: 'Henri Biva/3.webp' },
  { id: 'biva/4', path: 'Henri Biva/4.webp' },
  { id: 'biva/5', path: 'Henri Biva/5.webp' },
];

// Build lookup map for fast access
const COVER_BY_ID = new Map(BUILTIN_COVERS.map(c => [c.id, c]));

/** Prefix to identify built-in covers in asset paths */
export const BUILTIN_PREFIX = '@';

/**
 * Get all built-in covers
 */
export function getBuiltinCovers(): BuiltinCover[] {
  return BUILTIN_COVERS;
}

/**
 * Check if an asset path is a built-in cover
 */
export function isBuiltinCover(assetPath: string): boolean {
  return assetPath.startsWith(BUILTIN_PREFIX);
}

/**
 * Get the URL for a built-in cover
 * @param assetPath - Path with @ prefix, e.g. "@monet/1"
 */
export function getBuiltinCoverUrl(assetPath: string): string {
  const id = assetPath.slice(1); // Remove @ prefix
  const cover = COVER_BY_ID.get(id);
  if (!cover) {
    console.warn('Unknown built-in cover:', assetPath);
    return '';
  }
  return `/covers/${cover.path}`;
}

/**
 * Convert built-in cover to asset path format (for storage)
 */
export function toBuiltinAssetPath(cover: BuiltinCover): string {
  return `${BUILTIN_PREFIX}${cover.id}`;
}
