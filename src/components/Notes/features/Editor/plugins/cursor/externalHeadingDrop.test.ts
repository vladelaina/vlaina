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

  it('does not read aggregate body text while checking for extra content', () => {
    const bodyTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    const textContentSpy = vi.spyOn(Node.prototype, 'textContent', 'get').mockImplementation(function (this: Node) {
      if (this.nodeType === Node.ELEMENT_NODE && (this as Element).tagName === 'BODY') {
        throw new Error('aggregate body textContent should not be read');
      }

      return bodyTextContent?.get?.call(this) ?? null;
    });

    try {
      expect(parseSingleHeadingDropHtml('<h2>Title</h2>')).toEqual({
        level: 2,
        text: 'Title',
      });
      expect(parseSingleHeadingDropHtml('<h2>Title</h2><p>extra</p>')).toBeNull();
    } finally {
      textContentSpy.mockRestore();
    }
  });

  it('does not read aggregate heading text while parsing dropped html', () => {
    const textContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    const textContentSpy = vi.spyOn(Node.prototype, 'textContent', 'get').mockImplementation(function (this: Node) {
      if (this.nodeType === Node.ELEMENT_NODE && (this as Element).tagName === 'H2') {
        throw new Error('aggregate heading textContent should not be read');
      }

      return textContent?.get?.call(this) ?? null;
    });

    try {
      expect(parseSingleHeadingDropHtml('<h2>Title</h2>')).toEqual({
        level: 2,
        text: 'Title',
      });
    } finally {
      textContentSpy.mockRestore();
    }
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
