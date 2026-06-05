import type { TocItem } from './types';

export const TOC_EMPTY_TEXT = 'No headings yet';

export const MAX_TOC_VIEW_HEADINGS = 512;
const MAX_TOC_VIEW_HEADING_TEXT_CHARS = 240;

export function normalizeTocMaxLevel(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? Math.max(1, Math.min(6, Math.trunc(parsed)))
    : 6;
}

function normalizeHeadingLevel(value: unknown, maxLevel: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const level = Math.max(1, Math.min(6, Math.trunc(value)));
  return level <= maxLevel ? level : null;
}

export function extractHeadings(doc: {
  descendants: (callback: (node: any, pos: number) => boolean | void) => void;
}, maxLevel = 6): TocItem[] {
  const headings: TocItem[] = [];
  const normalizedMaxLevel = normalizeTocMaxLevel(maxLevel);

  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== 'heading' || headings.length >= MAX_TOC_VIEW_HEADINGS) {
      return;
    }

    const level = normalizeHeadingLevel(node.attrs?.level, normalizedMaxLevel);
    if (level === null) {
      return;
    }

    const text = String(node.textContent ?? '').slice(0, MAX_TOC_VIEW_HEADING_TEXT_CHARS);
    if (!text.trim()) {
      return;
    }

    headings.push({
      level,
      text,
      id: `heading-${pos}`,
      pos,
    });
  });

  return headings;
}

export function createHeadingsSignature(headings: readonly TocItem[]): string {
  return headings
    .map((heading) => `${heading.pos}:${heading.level}:${heading.text}`)
    .join('|');
}

export function renderTocContent(contentEl: HTMLElement, headings: readonly TocItem[], maxLevel: number): void {
  const doc = contentEl.ownerDocument;
  const normalizedMaxLevel = normalizeTocMaxLevel(maxLevel);
  const scopedHeadings = headings
    .filter((heading) => heading.level <= normalizedMaxLevel)
    .slice(0, MAX_TOC_VIEW_HEADINGS);

  if (scopedHeadings.length === 0) {
    const empty = doc.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = TOC_EMPTY_TEXT;
    contentEl.replaceChildren(empty);
    return;
  }

  const nav = doc.createElement('nav');
  nav.className = 'toc-nav';
  const list = doc.createElement('ul');
  list.className = 'toc-list';
  nav.appendChild(list);

  for (const heading of scopedHeadings) {
    const item = doc.createElement('li');
    item.className = `toc-item toc-level-${heading.level}`;
    item.style.paddingLeft = `${(heading.level - 1) * 16}px`;

    const link = doc.createElement('a');
    link.className = 'toc-link';
    link.href = '#';
    link.dataset.headingPos = String(heading.pos);
    link.textContent = heading.text;

    item.appendChild(link);
    list.appendChild(item);
  }

  contentEl.replaceChildren(nav);
}
