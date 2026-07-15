import { describe, expect, it } from 'vitest';
import {
  TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS,
  TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS,
  syncTyporaCompatibilityDomClasses,
} from './domClassesPlugin';

describe('typoraCompatibilityDomClasses', () => {
  it('marks Typora button groups that contain selected controls without CSS :has selectors', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span class="v-btn-group">
        <span class="v-btn selected">A</span>
      </span>
      <span class="v-btn-group">
        <span class="v-btn">B</span>
      </span>
    `;

    syncTyporaCompatibilityDomClasses(root);

    const [selectedGroup, plainGroup] = Array.from(root.querySelectorAll<HTMLElement>('.v-btn-group'));
    expect(selectedGroup?.classList.contains(TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS)).toBe(true);
    expect(plainGroup?.classList.contains(TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS)).toBe(false);
  });

  it('marks table figures that do not contain a Typora caption', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="milkdown-table-block table-figure">
        <div class="table-wrapper"></div>
      </div>
      <figure class="table-figure">
        <figcaption class="v-caption">Caption</figcaption>
      </figure>
    `;

    syncTyporaCompatibilityDomClasses(root);

    const tableBlock = root.querySelector<HTMLElement>('.milkdown-table-block.table-figure');
    const captionedFigure = root.querySelector<HTMLElement>('figure.table-figure');
    expect(tableBlock?.classList.contains(TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS)).toBe(true);
    expect(captionedFigure?.classList.contains(TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS)).toBe(false);
  });

  it('removes stale compatibility classes after DOM changes', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span class="v-btn-group"><span class="selected">A</span></span>
      <div class="milkdown-table-block table-figure"></div>
    `;
    const buttonGroup = root.querySelector<HTMLElement>('.v-btn-group')!;
    const tableFigure = root.querySelector<HTMLElement>('.milkdown-table-block')!;

    const synced = syncTyporaCompatibilityDomClasses(root);
    buttonGroup.querySelector('.selected')?.classList.remove('selected');
    tableFigure.innerHTML = '<span class="v-caption">Caption</span>';
    syncTyporaCompatibilityDomClasses(root, synced);

    expect(buttonGroup.classList.contains(TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS)).toBe(false);
    expect(tableFigure.classList.contains(TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS)).toBe(false);
  });
});
