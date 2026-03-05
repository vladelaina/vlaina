import type { NotesOutlineHeading } from './types';

const OUTLINE_FALLBACK_TEXT = 'Untitled';

export function getHeadingLevelFromTagName(tagName: string): number | null {
  const normalized = tagName.toLowerCase();
  if (!/^h[1-6]$/.test(normalized)) return null;
  return Number.parseInt(normalized.slice(1), 10);
}

export function normalizeHeadingText(rawText: string): string {
  const compact = rawText.replace(/\s+/g, ' ').trim();
  return compact.length > 0 ? compact : OUTLINE_FALLBACK_TEXT;
}

function slugifyHeadingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

export function createOutlineHeadingId(index: number, level: number, text: string): string {
  const slug = slugifyHeadingText(text);
  const suffix = slug.length > 0 ? slug : 'heading';
  return `outline-${index}-h${level}-${suffix}`;
}

export function areOutlineHeadingsEqual(
  previous: NotesOutlineHeading[],
  next: NotesOutlineHeading[],
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const left = previous[index];
    const right = next[index];
    if (!left || !right) return false;
    if (left.id !== right.id || left.level !== right.level || left.text !== right.text) return false;
  }
  return true;
}
