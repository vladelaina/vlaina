import { describe, expect, it } from 'vitest';
import {
  NATIVE_SELECTED_HAS_NEXT_CLASS,
  NATIVE_SELECTED_HAS_PREVIOUS_CLASS,
  NATIVE_SELECTED_TEXTLIKE_CLASS,
  TABLE_BLOCK_ZERO_MIN_WIDTH_CLASS,
  isNativeSelectedTextLikeElement,
  syncNativeSelectedNodeClasses,
} from './nativeSelectedNodeClasses';

describe('nativeSelectedNodeClasses', () => {
  it('marks native selected text-like nodes without CSS :has selectors', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <p class="ProseMirror-selectednode">Plain</p>
      <p class="ProseMirror-selectednode"><span class="image-block-container"></span></p>
    `;

    const [plain, rich] = Array.from(root.querySelectorAll<HTMLElement>('.ProseMirror-selectednode'));

    expect(isNativeSelectedTextLikeElement(plain!)).toBe(true);
    expect(isNativeSelectedTextLikeElement(rich!)).toBe(false);

    syncNativeSelectedNodeClasses(root);

    expect(plain?.classList.contains(NATIVE_SELECTED_TEXTLIKE_CLASS)).toBe(true);
    expect(rich?.classList.contains(NATIVE_SELECTED_TEXTLIKE_CLASS)).toBe(false);
  });

  it('recognizes Markdown text-like native selected block variants', () => {
    const samples = [
      '<p></p>',
      '<h1></h1>',
      '<h6></h6>',
      '<blockquote></blockquote>',
      '<hr>',
      '<div class="md-hr"></div>',
      '<li></li>',
      '<dl></dl>',
      '<dt></dt>',
      '<dd></dd>',
      '<div class="definition-list"></div>',
      '<div class="definition-term"></div>',
      '<div class="definition-desc"></div>',
      '<div class="footnote-def"></div>',
      '<div class="toc-block"></div>',
      '<div class="callout"></div>',
      '<div data-type="html-block" data-value="<!--vlaina-markdown-blank-line-->"></div>',
    ];

    for (const sample of samples) {
      const root = document.createElement('div');
      root.innerHTML = sample;
      const element = root.firstElementChild as HTMLElement | null;

      expect(element, sample).not.toBeNull();
      expect(isNativeSelectedTextLikeElement(element!), sample).toBe(true);
    }
  });

  it('does not mark real html preview blocks as native selected text-like nodes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-type="html-block" data-value="<p>HTML</p>" class="ProseMirror-selectednode"></div>';
    const element = root.firstElementChild as HTMLElement;

    expect(isNativeSelectedTextLikeElement(element)).toBe(false);

    syncNativeSelectedNodeClasses(root);

    expect(element.classList.contains(NATIVE_SELECTED_TEXTLIKE_CLASS)).toBe(false);
  });

  it('marks adjacent native selected text-like nodes explicitly', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <p class="ProseMirror-selectednode">First</p>
      <p class="ProseMirror-selectednode">Second</p>
      <p>Third</p>
    `;

    syncNativeSelectedNodeClasses(root);

    const [first, second] = Array.from(root.querySelectorAll<HTMLElement>('.ProseMirror-selectednode'));
    expect(first?.classList.contains(NATIVE_SELECTED_HAS_NEXT_CLASS)).toBe(true);
    expect(first?.classList.contains(NATIVE_SELECTED_HAS_PREVIOUS_CLASS)).toBe(false);
    expect(second?.classList.contains(NATIVE_SELECTED_HAS_NEXT_CLASS)).toBe(false);
    expect(second?.classList.contains(NATIVE_SELECTED_HAS_PREVIOUS_CLASS)).toBe(true);
  });

  it('removes stale native selected classes after selection changes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="ProseMirror-selectednode">Plain</p>';
    const paragraph = root.querySelector<HTMLElement>('p')!;

    const synced = syncNativeSelectedNodeClasses(root);
    paragraph.classList.remove('ProseMirror-selectednode');
    syncNativeSelectedNodeClasses(root, synced);

    expect(paragraph.classList.contains(NATIVE_SELECTED_TEXTLIKE_CLASS)).toBe(false);
  });

  it('marks zero-min-width table blocks without table-block :has selectors', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="milkdown-table-block">
        <div class="table-wrapper" style="--table-block-table-min-width: 0px"></div>
      </div>
      <div class="milkdown-table-block">
        <div class="table-wrapper" style="--table-block-table-min-width: 640px"></div>
      </div>
    `;

    syncNativeSelectedNodeClasses(root);

    const [zeroMinWidth, fixedWidth] = Array.from(root.querySelectorAll<HTMLElement>('.milkdown-table-block'));
    expect(zeroMinWidth?.classList.contains(TABLE_BLOCK_ZERO_MIN_WIDTH_CLASS)).toBe(true);
    expect(fixedWidth?.classList.contains(TABLE_BLOCK_ZERO_MIN_WIDTH_CLASS)).toBe(false);
  });
});
