import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  applyTableMenuState,
  resolveTableContextMenuPosition,
} from './tableContextMenuPlugin';
import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';

describe('table context menu target', () => {
  it('closes an open table context menu after table input changes the document', () => {
    expect(
      applyTableMenuState(
        {
          isOpen: true,
          position: { x: 120, y: 80 },
          cellPos: 12,
        },
        undefined,
        true,
      ),
    ).toEqual({
      isOpen: false,
      position: { x: 0, y: 0 },
      cellPos: -1,
    });
  });

  it('keeps explicit table context menu meta authoritative', () => {
    expect(
      applyTableMenuState(
        {
          isOpen: false,
          position: { x: 0, y: 0 },
          cellPos: -1,
        },
        {
          isOpen: true,
          position: { x: 240, y: 160 },
          cellPos: 18,
        },
        true,
      ),
    ).toEqual({
      isOpen: true,
      position: { x: 240, y: 160 },
      cellPos: 18,
    });
  });

  it('keeps table context menu positioning inside the viewport', () => {
    expect(
      resolveTableContextMenuPosition({
        x: 390,
        y: 290,
        menuWidth: 196,
        menuHeight: 120,
        viewportWidth: 400,
        viewportHeight: 300,
      }),
    ).toEqual({
      left: 196,
      top: 172,
    });
  });

  it('marks the table context menu as non-editor chrome for blank-area pointer handling', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/plugins/table/tableContextMenuPlugin.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      "menuElement.setAttribute('data-no-editor-drag-box', 'true')",
    );
  });

  it('does not open the table context menu while the editor is readonly', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/plugins/table/tableContextMenuPlugin.ts',
      ),
      'utf8',
    );

    expect(source).toContain('if (!view.editable) return false;');
  });

  it('keeps the table context menu fixed-position and styled', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/styles/table-block.css',
      ),
      'utf8',
    );

    expect(css).toContain('.table-context-menu {');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('.table-context-menu .table-menu-item {');
    expect(css).toContain('.table-context-menu .table-menu-item.danger');
  });

  it('disables invisible table edge zones in readonly tables', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/styles/table-block.css',
      ),
      'utf8',
    );

    expect(css).toContain(
      '.milkdown .milkdown-table-block.readonly .edge-create-zone {',
    );
    expect(css).toContain('display: none;');
  });

  it('ignores internal table control targets', () => {
    const control = document.createElement('div');
    control.setAttribute('data-role', 'col-header-drag-control');

    expect(shouldIgnoreTableContextMenuTarget(control)).toBe(true);
  });

  it('ignores row header table control targets', () => {
    const control = document.createElement('div');
    control.setAttribute('data-role', 'row-header-drag-control');

    expect(shouldIgnoreTableContextMenuTarget(control)).toBe(true);
  });

  it('ignores descendants of internal table control targets', () => {
    const menu = document.createElement('div');
    menu.setAttribute('data-role', 'row-header-drag-menu');
    const child = document.createElement('span');
    menu.appendChild(child);

    expect(shouldIgnoreTableContextMenuTarget(child)).toBe(true);
  });

  it('does not ignore ordinary table cell content', () => {
    const paragraph = document.createElement('p');

    expect(shouldIgnoreTableContextMenuTarget(paragraph)).toBe(false);
  });
});
