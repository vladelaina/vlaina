import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlockDragPreview } from './blockDragPreview';

function createNode(typeName: string, nodeSize: number, children: any[] = []) {
  return {
    type: { name: typeName },
    nodeSize,
    childCount: children.length,
    forEach(cb: (child: any, offset: number) => void) {
      let offset = 0;
      for (const child of children) {
        cb(child, offset);
        offset += child.nodeSize;
      }
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createBlockDragPreview', () => {
  it('preserves the handle-to-block gap instead of snapping under the pointer', () => {
    const editorRoot = document.createElement('div');
    const block = document.createElement('p');
    block.textContent = 'Drag me';
    editorRoot.appendChild(block);
    document.body.appendChild(editorRoot);

    const view = {
      dom: editorRoot,
      state: {
        doc: {
          content: { size: 10 },
          forEach(cb: (child: any, offset: number) => void) {
            cb(createNode('paragraph', 10), 0);
          },
          resolve(pos: number) {
            return {
              pos,
              depth: 0,
              nodeAfter: createNode('paragraph', 10),
              node() {
                return createNode('doc', 10);
              },
              before() {
                return 0;
              },
            };
          },
        },
      },
      nodeDOM() {
        return block;
      },
      domAtPos() {
        return { node: block.firstChild as Node };
      },
    } as any;

    const previewRect = {
      left: 0,
      top: 0,
      width: 240,
      height: 32,
      right: 240,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === block) {
          return {
            left: 120,
            top: 80,
            width: 240,
            height: 32,
            right: 360,
            bottom: 112,
            x: 120,
            y: 80,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this.dataset.noEditorDragBox === 'true') {
          return previewRect as DOMRect;
        }
        return {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    const handleClientX = 88;
    const preview = createBlockDragPreview({
      view,
      ranges: [{ from: 0, to: 5 }],
      clientX: handleClientX,
      clientY: 96,
    });

    expect(preview).not.toBeNull();
    expect(preview?.offsetX).toBe(handleClientX - 120);
    expect(handleClientX - (preview?.offsetX ?? 0)).toBe(120);

    preview?.destroy();
    rectSpy.mockRestore();
  });

  it('does not duplicate nested list content when parent and child ranges are both selected', () => {
    const editorRoot = document.createElement('div');
    const list = document.createElement('ol');
    const parentItem = document.createElement('li');
    const parentText = document.createElement('p');
    const nestedList = document.createElement('ol');
    const childItem = document.createElement('li');
    const childText = document.createElement('p');

    parentText.textContent = 'Parent';
    childText.textContent = 'Child';
    childItem.appendChild(childText);
    nestedList.appendChild(childItem);
    parentItem.append(parentText, nestedList);
    list.appendChild(parentItem);
    editorRoot.appendChild(list);
    document.body.appendChild(editorRoot);

    const parentRect = { left: 120, top: 80, width: 260, height: 28, right: 380, bottom: 108, x: 120, y: 80, toJSON: () => ({}) };
    const childRect = { left: 156, top: 116, width: 224, height: 24, right: 380, bottom: 140, x: 156, y: 116, toJSON: () => ({}) };
    const previewRect = { left: 0, top: 0, width: 260, height: 60, right: 260, bottom: 60, x: 0, y: 0, toJSON: () => ({}) };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === parentItem) return parentRect as DOMRect;
        if (this === parentText) return parentRect as DOMRect;
        if (this === childItem) return childRect as DOMRect;
        if (this === childText) return childRect as DOMRect;
        if (this.dataset.noEditorDragBox === 'true') return previewRect as DOMRect;
        return {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    const nestedListItemNode = createNode('list_item', 8, [createNode('paragraph', 6)]);
    const nestedListWithItemNode = createNode('ordered_list', 10, [nestedListItemNode]);
    const parentListItemNode = createNode('list_item', 22, [
      createNode('paragraph', 10),
      nestedListWithItemNode,
    ]);
    const listNode = createNode('ordered_list', 24, [parentListItemNode]);

    const view = {
      dom: editorRoot,
      state: {
        doc: {
          content: { size: 32 },
          forEach(cb: (child: any, offset: number) => void) {
            cb(listNode, 0);
          },
          resolve(pos: number) {
            return {
              pos,
              depth: 1,
              nodeAfter: pos === 1 ? parentListItemNode : pos === 13 ? nestedListItemNode : null,
              node() {
                return listNode;
              },
              before() {
                return 0;
              },
            };
          },
        },
      },
      nodeDOM(pos: number) {
        if (pos >= 13) return childItem;
        return parentItem;
      },
      domAtPos(pos: number) {
        if (pos >= 14) return { node: childText.firstChild as Node };
        return { node: parentText.firstChild as Node };
      },
    } as any;

    const preview = createBlockDragPreview({
      view,
      ranges: [
        { from: 1, to: 13 },
        { from: 13, to: 21 },
      ],
      clientX: 88,
      clientY: 96,
    });

    expect(preview).not.toBeNull();
    expect(preview?.element.querySelectorAll('li')).toHaveLength(2);

    preview?.destroy();
    rectSpy.mockRestore();
  });
});
