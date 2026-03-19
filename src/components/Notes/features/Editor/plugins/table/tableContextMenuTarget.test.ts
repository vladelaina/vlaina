import { describe, expect, it } from 'vitest';

import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';

describe('table context menu target', () => {
  it('ignores internal table control targets', () => {
    const control = document.createElement('div');
    control.setAttribute('data-role', 'col-header-drag-control');

    expect(shouldIgnoreTableContextMenuTarget(control)).toBe(true);
  });

  it('ignores descendants of internal table control targets', () => {
    const menu = document.createElement('div');
    menu.setAttribute('data-role', 'col-header-drag-menu');
    const child = document.createElement('span');
    menu.appendChild(child);

    expect(shouldIgnoreTableContextMenuTarget(child)).toBe(true);
  });

  it('does not ignore ordinary table cell content', () => {
    const paragraph = document.createElement('p');

    expect(shouldIgnoreTableContextMenuTarget(paragraph)).toBe(false);
  });
});
