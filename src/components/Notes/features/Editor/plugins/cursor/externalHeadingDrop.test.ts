import { describe, expect, it, vi } from 'vitest';
import {
  MAX_HEADING_DROP_SCAN_ELEMENTS,
  parseSingleHeadingDropHtml,
} from './externalHeadingDrop';

describe('externalHeadingDrop', () => {
  it('parses a single heading from dropped html', () => {
    expect(parseSingleHeadingDropHtml('<h2>Title</h2>')).toEqual({
      level: 2,
      text: 'Title',
    });
  });

  it('rejects dropped html that contains content outside the heading', () => {
    expect(parseSingleHeadingDropHtml('<h2>Title</h2><p>extra</p>')).toBeNull();
  });

  it('rejects oversized dropped html before parsing', () => {
    expect(parseSingleHeadingDropHtml(`<h1>${'x'.repeat(64 * 1024)}</h1>`)).toBeNull();
  });

  it('rejects oversized heading text after parsing', () => {
    expect(parseSingleHeadingDropHtml(`<h1>${'x'.repeat(2_001)}</h1>`)).toBeNull();
  });

  it('parses dropped headings without materializing selector results', () => {
    const querySelectorAllSpy = vi.spyOn(Document.prototype, 'querySelectorAll');

    try {
      expect(parseSingleHeadingDropHtml('<h3>Title</h3>')).toEqual({
        level: 3,
        text: 'Title',
      });
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      querySelectorAllSpy.mockRestore();
    }
  });

  it('rejects dropped html when heading scan budget is exceeded', () => {
    const spans = '<span>x</span>'.repeat(MAX_HEADING_DROP_SCAN_ELEMENTS + 1);

    expect(parseSingleHeadingDropHtml(`${spans}<h1>Title</h1>`)).toBeNull();
  });
});
