import { describe, expect, it } from 'vitest';
import { parseSingleHeadingDropHtml } from './externalHeadingDrop';

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
});
