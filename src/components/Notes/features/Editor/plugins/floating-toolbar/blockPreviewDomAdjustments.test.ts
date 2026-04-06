import { describe, expect, it } from 'vitest';
import {
  collectBlockPreviewDomAdjustments,
  getBlockPreviewStructuralStyles,
  PREVIEW_HIDE_BLOCKQUOTE_ATTR,
  PREVIEW_HIDE_LIST_MARKER_ATTR,
} from './blockPreviewDomAdjustments';

describe('blockPreviewDomAdjustments', () => {
  it('offsets previewed blocks to cancel list indentation', () => {
    const list = document.createElement('ul');
    const item = document.createElement('li');
    const paragraph = document.createElement('p');

    item.appendChild(paragraph);
    list.appendChild(item);

    expect(getBlockPreviewStructuralStyles(paragraph)).toEqual({
      marginLeft: 'calc(-1.5rem)',
    });
  });

  it('marks list item and blockquote ancestors so their native chrome can be hidden', () => {
    const blockquote = document.createElement('blockquote');
    const list = document.createElement('ul');
    const item = document.createElement('li');
    item.setAttribute('data-item-type', 'task');
    const paragraph = document.createElement('p');

    item.appendChild(paragraph);
    list.appendChild(item);
    blockquote.appendChild(list);

    const adjustments = collectBlockPreviewDomAdjustments(paragraph);

    expect(adjustments).toHaveLength(2);
    expect(adjustments[0]).toEqual({
      node: item,
      attributes: {
        [PREVIEW_HIDE_LIST_MARKER_ATTR]: 'true',
      },
    });
    expect(adjustments[1]).toEqual({
      node: blockquote,
      attributes: {
        [PREVIEW_HIDE_BLOCKQUOTE_ATTR]: 'true',
      },
    });
  });

  it('leaves top-level paragraphs unchanged', () => {
    const paragraph = document.createElement('p');

    expect(getBlockPreviewStructuralStyles(paragraph)).toEqual({});
    expect(collectBlockPreviewDomAdjustments(paragraph)).toEqual([]);
  });
});
