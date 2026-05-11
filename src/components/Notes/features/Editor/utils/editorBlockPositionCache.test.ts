import { describe, expect, it } from 'vitest';
import {
  createCurrentEditorBlockPositionController,
  getCurrentEditorBlockPositionSnapshot,
  isEditorHiddenByToolbarPreview,
  resolveToolbarPreviewRoot,
} from './editorBlockPositionCache';

function rect(top: number, bottom: number, width = 320): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 0,
    right: width,
    top,
    width,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('editorBlockPositionCache', () => {
  it('detects toolbar-applied previews that temporarily hide the live editor', () => {
    const dom = document.createElement('div');

    expect(isEditorHiddenByToolbarPreview({ dom })).toBe(false);

    dom.setAttribute('data-toolbar-preview-hidden', 'true');
    expect(isEditorHiddenByToolbarPreview({ dom })).toBe(true);

    dom.removeAttribute('data-toolbar-preview-hidden');
    expect(isEditorHiddenByToolbarPreview({ dom })).toBe(false);
  });

  it('resolves the toolbar preview root rendered next to the hidden editor', () => {
    const host = document.createElement('div');
    const preview = document.createElement('div');
    const dom = document.createElement('div');
    preview.className = 'toolbar-applied-preview-overlay';
    dom.setAttribute('data-toolbar-preview-hidden', 'true');
    host.append(preview, dom);

    expect(resolveToolbarPreviewRoot({ dom })).toBe(preview);

    dom.removeAttribute('data-toolbar-preview-hidden');
    expect(resolveToolbarPreviewRoot({ dom })).toBeNull();
  });

  it('publishes outline headings from the live toolbar preview without replacing the editor root', () => {
    const scrollRoot = document.createElement('div');
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.scrollTop = 40;
    scrollRoot.getBoundingClientRect = () => rect(10, 610, 640);

    const host = document.createElement('div');
    const preview = document.createElement('div');
    const heading = document.createElement('h2');
    const dom = document.createElement('div');

    preview.className = 'toolbar-applied-preview-overlay';
    heading.textContent = 'Preview heading';
    heading.getBoundingClientRect = () => rect(100, 132);
    dom.setAttribute('data-toolbar-preview-hidden', 'true');

    preview.appendChild(heading);
    host.append(preview, dom);
    scrollRoot.appendChild(host);
    document.body.appendChild(scrollRoot);

    const doc = {
      content: { size: 18 },
      forEach(callback: (node: { nodeSize: number }, offset: number) => void) {
        callback({ nodeSize: 18 }, 0);
      },
    };
    const view = {
      dom,
      state: { doc },
    };

    const controller = createCurrentEditorBlockPositionController(view as any);
    const snapshot = getCurrentEditorBlockPositionSnapshot();

    expect(snapshot?.editorRoot).toBe(dom);
    expect(snapshot?.headings).toHaveLength(1);
    expect(snapshot?.headings[0]).toMatchObject({
      id: 'outline-0-h2-preview-heading',
      level: 2,
      text: 'Preview heading',
      top: 130,
    });
    expect(snapshot?.headings[0]?.element).toBe(heading);

    controller.destroy();
    scrollRoot.remove();
  });

  it('skips expensive block snapshots for very large documents', () => {
    const dom = document.createElement('div');
    document.body.appendChild(dom);

    const doc = {
      childCount: 5001,
      content: { size: 5001 },
      forEach() {
        throw new Error('large documents should not be scanned');
      },
    };
    const view = {
      dom,
      state: { doc },
    };

    const controller = createCurrentEditorBlockPositionController(view as any);
    const snapshot = getCurrentEditorBlockPositionSnapshot();

    expect(snapshot?.blocks).toEqual([]);
    expect(snapshot?.headings).toEqual([]);

    controller.destroy();
    dom.remove();
  });
});
