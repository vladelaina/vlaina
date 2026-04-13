export interface BuiltinCover {
  id: string;
  path: string;
}

const BUILTIN_COVERS: BuiltinCover[] = [
  { id: 'monet/1', path: 'Claude Monet/1.webp' },
  { id: 'monet/2', path: 'Claude Monet/2.webp' },
  { id: 'monet/3', path: 'Claude Monet/3.webp' },
  { id: 'monet/4', path: 'Claude Monet/4.webp' },
  { id: 'monet/5', path: 'Claude Monet/5.webp' },
  { id: 'biva/1', path: 'Henri Biva/1.webp' },
  { id: 'biva/2', path: 'Henri Biva/2.webp' },
  { id: 'biva/3', path: 'Henri Biva/3.webp' },
  { id: 'biva/4', path: 'Henri Biva/4.webp' },
  { id: 'biva/5', path: 'Henri Biva/5.webp' },
];

const COVER_BY_ID = new Map(BUILTIN_COVERS.map(c => [c.id, c]));

export const BUILTIN_PREFIX = '@';

export function getBuiltinCovers(): BuiltinCover[] {
  return BUILTIN_COVERS;
}

export function isBuiltinCover(assetPath: string): boolean {
  return assetPath.startsWith(BUILTIN_PREFIX);
}

export function getBuiltinCoverUrl(assetPath: string): string {
  const id = assetPath.slice(1); // Remove @ prefix
  const cover = COVER_BY_ID.get(id);
  if (!cover) {
    if (import.meta.env.DEV) console.warn('Unknown built-in cover:', assetPath);
    return '';
  }
  return `/covers/${cover.path}`;
}

export function toBuiltinAssetPath(cover: BuiltinCover): string {
  return `${BUILTIN_PREFIX}${cover.id}`;
}

export function getRandomBuiltinCover(): string {
  const randomIndex = Math.floor(Math.random() * BUILTIN_COVERS.length);
  return toBuiltinAssetPath(BUILTIN_COVERS[randomIndex]);
}
