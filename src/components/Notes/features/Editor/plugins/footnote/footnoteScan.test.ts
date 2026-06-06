import { describe, expect, it } from 'vitest';
import {
  collectFootnoteElements,
  docHasFootnoteNodes,
  isFootnoteReferenceElement,
  MAX_FOOTNOTE_DOC_SCAN_NODES,
  scanFootnoteNodes,
  stepSliceContainsFootnote,
} from './footnoteScan';

function createScanNode(name: string, children: any[] = []) {
  return {
    type: { name },
    childCount: children.length,
    child: (index: number) => children[index],
  };
}

describe('footnoteScan', () => {
  it('collects matching footnote DOM elements without scanning past the budget', () => {
    const root = document.createElement('div');
    for (let index = 0; index < 6; index += 1) {
      const ref = document.createElement('sup');
      ref.className = 'footnote-ref';
      ref.dataset.id = String(index);
      root.append(ref);
    }

    const matches = collectFootnoteElements(root, isFootnoteReferenceElement, 10, 3);

    expect(matches).toHaveLength(3);
    expect(matches.map((match) => match.dataset.id)).toEqual(['0', '1', '2']);
  });

  it('stops document node scans once a footnote node is found', () => {
    const doc = createScanNode('doc', [
      createScanNode('paragraph'),
      createScanNode('footnote_reference'),
      createScanNode('paragraph'),
    ]);

    expect(scanFootnoteNodes(doc, 10)).toEqual({ found: true, exhausted: false });
  });

  it('treats exhausted document scans as possibly containing footnotes', () => {
    const doc = createScanNode('doc', [
      createScanNode('paragraph'),
      createScanNode('paragraph'),
      createScanNode('paragraph'),
    ]);

    const oversizedContent = createScanNode(
      'doc',
      Array.from({ length: MAX_FOOTNOTE_DOC_SCAN_NODES + 1 }, () => createScanNode('paragraph'))
    );

    expect(scanFootnoteNodes(doc, 2)).toEqual({ found: false, exhausted: true });
    expect(docHasFootnoteNodes(doc, 2)).toBe(true);
    expect(stepSliceContainsFootnote({ slice: { content: oversizedContent } })).toBe(true);
  });
});
