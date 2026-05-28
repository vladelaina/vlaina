import { describe, expect, it, vi } from 'vitest';
import {
  createCurrentEditorBlockPositionController,
  clearCurrentEditorBlockPositionSnapshot,
  getCachedEditorBlockTargetByPos,
  getCachedEditorBlockTargets,
  getCurrentEditorBlockPositionSnapshot,
  isEditorHiddenByToolbarPreview,
  resolveToolbarPreviewRoot,
  setCurrentEditorBlockPositionSnapshot,
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

  it('updates cached viewport rects on scroll without remeasuring every block', async () => {
    const scrollRoot = document.createElement('div');
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.scrollTop = 20;
    scrollRoot.getBoundingClientRect = () => rect(10, 610, 640);

    const host = document.createElement('div');
    const preview = document.createElement('div');
    const heading = document.createElement('h2');
    const dom = document.createElement('div');
    const headingRect = vi.fn(() => rect(100, 132));

    preview.className = 'toolbar-applied-preview-overlay';
    heading.textContent = 'Preview heading';
    heading.getBoundingClientRect = headingRect;
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
    const initial = getCurrentEditorBlockPositionSnapshot();
    expect(initial?.blocks[0]?.rect.top).toBe(100);
    expect(initial?.blocks[0]?.documentTop).toBe(110);
    expect(headingRect).toHaveBeenCalledTimes(1);

    heading.getBoundingClientRect = () => {
      throw new Error('scroll updates should not remeasure block DOM');
    };
    scrollRoot.scrollTop = 70;
    scrollRoot.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const scrolled = getCurrentEditorBlockPositionSnapshot();
    expect(scrolled?.scrollTop).toBe(70);
    expect(scrolled?.blocks[0]?.rect.top).toBe(50);
    expect(scrolled?.blocks[0]?.rect.bottom).toBe(82);
    expect(scrolled?.blocks[0]?.documentTop).toBe(110);
    expect(scrolled?.headings[0]?.top).toBe(110);

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

  it('does not return block targets from a stale document snapshot', () => {
    const dom = document.createElement('div');
    document.body.appendChild(dom);
    const oldDoc = { content: { size: 4 } };
    const newDoc = { content: { size: 4 } };
    const block = document.createElement('p');
    dom.appendChild(block);

    const view = {
      dom,
      state: { doc: newDoc },
    };

    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view: view as any,
      doc: oldDoc as any,
      editorRoot: dom,
      scrollRoot: null,
      scrollLeft: 0,
      scrollTop: 0,
      blocks: [{
        from: 0,
        to: 4,
        element: block,
        rect: rect(10, 30),
        documentTop: 10,
        documentBottom: 30,
        tagName: 'P',
        headingLevel: null,
        headingId: null,
        headingText: null,
      }],
      headings: [],
    });

    try {
      expect(getCachedEditorBlockTargets(view as any)).toBeNull();
      expect(getCachedEditorBlockTargetByPos(view as any, 0)).toBeNull();
    } finally {
      clearCurrentEditorBlockPositionSnapshot();
      dom.remove();
    }
  });

  it('does not return block targets from a stale scroll snapshot', () => {
    const scrollRoot = document.createElement('div');
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.scrollTop = 20;
    scrollRoot.getBoundingClientRect = () => rect(0, 200, 640);
    const dom = document.createElement('div');
    const block = document.createElement('p');
    dom.appendChild(block);
    scrollRoot.appendChild(dom);
    document.body.appendChild(scrollRoot);

    const doc = {
      content: { size: 4 },
      resolve: () => ({
        nodeAfter: { type: { name: 'paragraph' }, nodeSize: 4 },
      }),
    };
    const view = {
      dom,
      state: { doc },
    };

    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view: view as any,
      doc: doc as any,
      editorRoot: dom,
      scrollRoot,
      scrollLeft: 0,
      scrollTop: 20,
      blocks: [{
        from: 0,
        to: 4,
        element: block,
        rect: rect(10, 30),
        documentTop: 30,
        documentBottom: 50,
        tagName: 'P',
        headingLevel: null,
        headingId: null,
        headingText: null,
      }],
      headings: [],
    });

    try {
      scrollRoot.scrollTop = 80;

      expect(getCachedEditorBlockTargets(view as any)).toBeNull();
      expect(getCachedEditorBlockTargetByPos(view as any, 0)).toBeNull();
    } finally {
      clearCurrentEditorBlockPositionSnapshot();
      scrollRoot.remove();
    }
  });
});
