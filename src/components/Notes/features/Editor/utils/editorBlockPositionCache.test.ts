import { describe, expect, it, vi } from 'vitest';
import {
  createCurrentEditorBlockPositionController,
  clearCurrentEditorBlockPositionSnapshot,
  type EditorBlockPositionEntry,
  type EditorBlockPositionSnapshot,
  getCachedEditorBlockTargetByPos,
  getCachedEditorBlockTargets,
  getCurrentEditorBlockPositionSnapshot,
  isEditorHiddenByToolbarPreview,
  MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS,
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

function withBlockIndex(
  snapshot: Omit<EditorBlockPositionSnapshot, 'blockIndex'>,
): EditorBlockPositionSnapshot {
  return {
    ...snapshot,
    blockIndex: new Map(snapshot.blocks.map((block: EditorBlockPositionEntry) => [`${block.from}:${block.to}`, block])),
  };
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

  it('scans toolbar preview children without materializing the child list', () => {
    const host = document.createElement('div');
    const preview = document.createElement('div');
    const dom = document.createElement('div');
    const first = document.createElement('p');
    const second = document.createElement('h3');
    const arrayFromSpy = vi.spyOn(Array, 'from');

    preview.className = 'toolbar-applied-preview-overlay';
    first.textContent = 'First';
    second.textContent = 'Second heading';
    first.getBoundingClientRect = () => rect(20, 44);
    second.getBoundingClientRect = () => rect(60, 92);
    dom.setAttribute('data-toolbar-preview-hidden', 'true');

    preview.append(first, second);
    host.append(preview, dom);
    document.body.appendChild(host);

    const doc = {
      childCount: 2,
      content: { size: 8 },
      forEach(callback: (node: { nodeSize: number }, offset: number) => void) {
        callback({ nodeSize: 4 }, 0);
        callback({ nodeSize: 4 }, 4);
      },
    };
    const view = {
      dom,
      state: { doc },
    };

    try {
      const controller = createCurrentEditorBlockPositionController(view as any);
      const snapshot = getCurrentEditorBlockPositionSnapshot();

      expect(snapshot?.blocks).toHaveLength(2);
      expect(snapshot?.headings[0]).toMatchObject({
        id: 'outline-0-h3-second-heading',
        level: 3,
        text: 'Second heading',
      });
      expect(arrayFromSpy).not.toHaveBeenCalled();

      controller.destroy();
    } finally {
      arrayFromSpy.mockRestore();
      host.remove();
    }
  });

  it('skips expensive block snapshots for very large documents', () => {
    const dom = document.createElement('div');
    document.body.appendChild(dom);

    const doc = {
      childCount: MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS + 1,
      content: { size: MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS + 1 },
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

  it('adjusts cached target viewport rects lazily on scroll without remeasuring or cloning every block', async () => {
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
    expect(scrolled?.blocks).toBe(initial?.blocks);
    expect(scrolled?.blockIndex).toBe(initial?.blockIndex);
    expect(scrolled?.blocks[0]?.rect.top).toBe(100);
    expect(scrolled?.blocks[0]?.rect.bottom).toBe(132);
    expect(scrolled?.blocks[0]?.documentTop).toBe(110);
    expect(scrolled?.headings[0]?.top).toBe(110);
    expect(getCachedEditorBlockTargets(view as any)?.[0]?.rect.top).toBe(50);
    expect(getCachedEditorBlockTargets(view as any)?.[0]?.rect.bottom).toBe(82);

    controller.destroy();
    scrollRoot.remove();
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

    setCurrentEditorBlockPositionSnapshot(withBlockIndex({
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
    }));

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

    setCurrentEditorBlockPositionSnapshot(withBlockIndex({
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
    }));

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
