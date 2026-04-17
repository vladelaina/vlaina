import { describe, expect, it } from 'vitest';
import { resolveOrderedListPreviewLabel } from './blockPreviewListLabel';

describe('blockPreviewListLabel', () => {
  it('numbers top-level preview targets from one', () => {
    const paragraph = document.createElement('p');

    expect(resolveOrderedListPreviewLabel(paragraph, 0)).toBe('1.');
    expect(resolveOrderedListPreviewLabel(paragraph, 2)).toBe('3.');
  });

  it('reuses the item index when previewing inside an unordered list', () => {
    const list = document.createElement('ul');
    const first = document.createElement('li');
    const second = document.createElement('li');
    const paragraph = document.createElement('p');

    first.appendChild(document.createElement('p'));
    second.appendChild(paragraph);
    list.append(first, second);

    expect(resolveOrderedListPreviewLabel(paragraph, 0)).toBe('2.');
  });

  it('respects ordered list start offsets', () => {
    const list = document.createElement('ol');
    list.setAttribute('start', '4');
    const first = document.createElement('li');
    const second = document.createElement('li');
    const paragraph = document.createElement('p');

    first.appendChild(document.createElement('p'));
    second.appendChild(paragraph);
    list.append(first, second);

    expect(resolveOrderedListPreviewLabel(paragraph, 0)).toBe('5.');
  });
});
