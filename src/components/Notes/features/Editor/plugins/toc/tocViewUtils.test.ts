import { describe, expect, it, vi } from 'vitest';
import {
  extractHeadings,
  MAX_TOC_VIEW_HEADING_TEXT_CHARS,
  MAX_TOC_VIEW_HEADINGS,
  normalizeTocMaxLevel,
  readBoundedTocHeadingText,
  renderTocContent,
  TOC_EMPTY_TEXT,
} from './tocViewUtils';
import type { TocItem } from './types';

function createDoc(headings: Array<{ level: number; text: string; pos?: number }>) {
  const nodes = headings.map((heading) => ({
    attrs: { level: heading.level },
    nodeSize: typeof heading.pos === 'number' && heading.pos >= 0 ? 1 : 1,
    textContent: heading.text,
    type: { name: 'heading' },
  }));
  return {
    child: (index: number) => nodes[index],
    childCount: nodes.length,
  };
}

describe('tocViewUtils', () => {
  it('normalizes TOC max levels from DOM attrs and node attrs', () => {
    expect(normalizeTocMaxLevel('2')).toBe(2);
    expect(normalizeTocMaxLevel('999')).toBe(6);
    expect(normalizeTocMaxLevel(0)).toBe(1);
    expect(normalizeTocMaxLevel(Number.NaN)).toBe(6);
  });

  it('extracts bounded heading items for editor TOC rendering', () => {
    const headings = Array.from({ length: 520 }, (_, index) => ({
      level: 2,
      text: index === 0 ? 'A'.repeat(260) : `Heading ${index}`,
    }));

    const items = extractHeadings(createDoc(headings));

    expect(items).toHaveLength(512);
    expect(items[0]).toEqual({
      level: 2,
      text: 'A'.repeat(240),
      id: 'heading-0',
      pos: 0,
    });
    expect(items[511]).toMatchObject({
      text: 'Heading 511',
      id: 'heading-511',
      pos: 511,
    });
  });

  it('reads heading text through bounded ProseMirror ranges when available', () => {
    const textBetween = vi.fn(() => 'A'.repeat(MAX_TOC_VIEW_HEADING_TEXT_CHARS));
    const node = {
      attrs: { level: 2 },
      content: { size: MAX_TOC_VIEW_HEADING_TEXT_CHARS + 100 },
      nodeSize: 1,
      textBetween,
      get textContent(): string {
        throw new Error('aggregate heading textContent should not be read');
      },
      type: { name: 'heading' },
    };

    expect(readBoundedTocHeadingText(node)).toBe('A'.repeat(MAX_TOC_VIEW_HEADING_TEXT_CHARS));
    expect(textBetween).toHaveBeenCalledWith(0, MAX_TOC_VIEW_HEADING_TEXT_CHARS, '', '');
  });

  it('stops scanning headings once the TOC item cap is reached', () => {
    let scanned = 0;
    const nodes = Array.from({ length: 600 }, (_, index) => ({
      attrs: { level: 2 },
      nodeSize: 1,
      textContent: `Heading ${index}`,
      type: { name: 'heading' },
    }));
    const doc = {
      child(index: number) {
        scanned += 1;
        if (index >= MAX_TOC_VIEW_HEADINGS) {
          throw new Error('TOC heading scan should stop at the heading cap');
        }
        return nodes[index];
      },
      childCount: nodes.length,
    };

    expect(extractHeadings(doc)).toHaveLength(MAX_TOC_VIEW_HEADINGS);
    expect(scanned).toBe(MAX_TOC_VIEW_HEADINGS);
  });

  it('filters headings above maxLevel while extracting', () => {
    const items = extractHeadings(createDoc([
      { level: 2, text: 'Shown' },
      { level: 4, text: 'Hidden' },
    ]), 3);

    expect(items).toEqual([{
      level: 2,
      text: 'Shown',
      id: 'heading-0',
      pos: 0,
    }]);
  });

  it('renders bounded TOC DOM and normalizes invalid maxLevel values', () => {
    const content = document.createElement('div');
    const headings: TocItem[] = Array.from({ length: 520 }, (_, index) => ({
      level: index % 2 === 0 ? 2 : 4,
      text: `Heading ${index}`,
      id: `heading-${index}`,
      pos: index,
    }));

    renderTocContent(content, headings, Number.NaN);

    expect(content.querySelectorAll('.toc-item')).toHaveLength(512);
    expect(content.querySelector('.toc-link')).toHaveTextContent('Heading 0');
    expect(content.querySelector('.toc-link')).toHaveAttribute('data-heading-pos', '0');
  });

  it('renders an empty placeholder when all headings exceed maxLevel', () => {
    const content = document.createElement('div');

    renderTocContent(content, [{
      level: 4,
      text: 'Hidden',
      id: 'heading-1',
      pos: 1,
    }], 2);

    expect(content.querySelector('.toc-empty')).toHaveTextContent(TOC_EMPTY_TEXT);
  });
});
