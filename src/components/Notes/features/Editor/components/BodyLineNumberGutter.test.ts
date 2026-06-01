import { describe, expect, it } from 'vitest';
import {
  collectBodyLineNumberTargets,
  resolveBodyLineNumberLabels,
} from './BodyLineNumberGutter';

function setRect(element: HTMLElement, rect: Partial<DOMRect>) {
  element.getBoundingClientRect = () => ({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('BodyLineNumberGutter', () => {
  it('collects body targets without code blocks or frontmatter blocks', () => {
    const editorRoot = document.createElement('div');
    editorRoot.className = 'ProseMirror';
    editorRoot.innerHTML = [
      '<div class="frontmatter-block-container"></div>',
      '<h1 id="heading">Title</h1>',
      '<div class="code-block-container"></div>',
      '<ul><li id="one">One</li><li id="two">Two</li></ul>',
      '<p id="paragraph">Text</p>',
    ].join('');

    expect(collectBodyLineNumberTargets(editorRoot).map((item) => item.id)).toEqual([
      'heading',
      'one',
      'two',
      'paragraph',
    ]);
  });

  it('resolves labels in an independent gutter before the editor content', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const heading = document.createElement('h1');
    const paragraph = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    shell.appendChild(editorRoot);
    editorRoot.append(heading, paragraph);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(heading, { left: 106, top: 40, height: 32 });
    setRect(paragraph, { left: 106, top: 80, height: 24 });

    const labels = resolveBodyLineNumberLabels(shell, '# Title\n\nBody');

    expect(labels).toEqual([
      { lineNumber: 1, left: 38, top: 36 },
      { lineNumber: 3, left: 38, top: 72 },
    ]);
  });

  it('hides labels for selected blocks without shifting source line numbers', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const first = document.createElement('p');
    const selected = document.createElement('p');
    const third = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    selected.className = 'editor-block-selected';
    shell.appendChild(editorRoot);
    editorRoot.append(first, selected, third);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(first, { left: 106, top: 40, height: 24 });
    setRect(selected, { left: 106, top: 72, height: 24 });
    setRect(third, { left: 106, top: 104, height: 24 });

    const labels = resolveBodyLineNumberLabels(shell, 'First\n\nSelected\n\nThird');

    expect(labels).toEqual([
      { lineNumber: 1, left: 38, top: 32 },
      { lineNumber: 5, left: 38, top: 96 },
    ]);
  });

  it('hides list item labels when a selected child paragraph carries the block selection class', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const list = document.createElement('ul');
    const first = document.createElement('li');
    const second = document.createElement('li');
    const selectedParagraph = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    selectedParagraph.className = 'editor-block-selected';
    second.appendChild(selectedParagraph);
    list.append(first, second);
    shell.appendChild(editorRoot);
    editorRoot.appendChild(list);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(first, { left: 106, top: 40, height: 24 });
    setRect(second, { left: 106, top: 72, height: 24 });

    const labels = resolveBodyLineNumberLabels(shell, '- First\n- Second');

    expect(labels).toEqual([{ lineNumber: 1, left: 38, top: 32 }]);
  });
});
