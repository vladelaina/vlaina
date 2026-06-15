import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';

describe('table context menu target', () => {
  it('marks the table context menu as non-editor chrome for blank-area pointer handling', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/table/tableContextMenuPlugin.ts'),
      'utf8',
    );

    expect(source).toContain("menuElement.setAttribute('data-no-editor-drag-box', 'true')");
  });

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
