import { describe, expect, it } from 'vitest';
import { createClosedMermaidEditorState } from './mermaidEditorState';
import {
  findMermaidEditorTargetElement,
  getMermaidAnchorViewportPosition,
  isMermaidScrollbarPointerDown,
  isSelectedScrollableMermaidElement,
  resolveMermaidAnchorElement,
} from './mermaidEditorOpenInteraction';
import { resolveMermaidEditorOpenState } from './mermaidEditorOpenResolver';

describe('mermaidEditorPlugin', () => {
  it('creates a closed default editor state', () => {
    expect(createClosedMermaidEditorState()).toEqual({
      isOpen: false,
      code: '',
      position: { x: 0, y: 0 },
      nodePos: -1,
      openSource: null,
    });
  });

  it('anchors the editor to the closest mermaid wrapper instead of an inner svg node', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(inner);
    wrapper.appendChild(svg);

    expect(resolveMermaidAnchorElement(inner, null)).toBe(wrapper);
  });

  it('positions the editor below the mermaid anchor rect in viewport coordinates', () => {
    const wrapper = document.createElement('div');
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({
        left: 120,
        right: 420,
        top: 40,
        bottom: 172,
        width: 300,
        height: 132,
        x: 120,
        y: 40,
        toJSON: () => ({}),
      }),
    });

    expect(getMermaidAnchorViewportPosition(wrapper)).toEqual({
      x: 120,
      y: 180,
    });
  });

  it('does not treat a nearby non-mermaid click target as a mermaid editor target', () => {
    const editor = document.createElement('div');
    const mermaid = document.createElement('div');
    mermaid.setAttribute('data-type', 'mermaid');
    const math = document.createElement('span');
    math.setAttribute('data-type', 'math-inline');
    editor.append(mermaid, math);

    expect(findMermaidEditorTargetElement({ dom: editor }, math)).toBeNull();
  });

  it('treats clicks in the horizontal scrollbar band as scrollbar interaction', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'mermaid');
    Object.defineProperty(wrapper, 'clientWidth', { value: 300 });
    Object.defineProperty(wrapper, 'scrollWidth', { value: 900 });
    Object.defineProperty(wrapper, 'clientHeight', { value: 120 });
    Object.defineProperty(wrapper, 'offsetHeight', { value: 120 });
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({
        left: 10,
        right: 310,
        top: 20,
        bottom: 140,
        width: 300,
        height: 120,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    });
    wrapper.style.overflowX = 'auto';

    expect(isMermaidScrollbarPointerDown({
      event: new MouseEvent('mousedown', { clientX: 120, clientY: 136 }),
      mermaidElement: wrapper,
    })).toBe(true);
    expect(isMermaidScrollbarPointerDown({
      event: new MouseEvent('mousedown', { clientX: 120, clientY: 90 }),
      mermaidElement: wrapper,
    })).toBe(false);
  });

  it('detects selected scrollable mermaid blocks so scrollbar clicks do not open the editor', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'mermaid');
    wrapper.className = 'mermaid-block editor-block-selected';
    Object.defineProperty(wrapper, 'clientWidth', { value: 300 });
    Object.defineProperty(wrapper, 'scrollWidth', { value: 900 });

    expect(isSelectedScrollableMermaidElement(wrapper)).toBe(true);
    wrapper.classList.remove('editor-block-selected');
    expect(isSelectedScrollableMermaidElement(wrapper)).toBe(false);
  });

  it('resolves an open state for an existing mermaid node', () => {
    const mermaidNode = {
      type: { name: 'mermaid' },
      attrs: { code: 'flowchart TD\nA --> B' },
    };
    const view = {
      state: {
        doc: {
          nodeAt: () => mermaidNode,
          resolve: () => ({
            depth: 1,
            node: () => mermaidNode,
            before: () => 5,
          }),
        },
      },
    };

    expect(
      resolveMermaidEditorOpenState({
        view: view as never,
        pos: 5,
        getPosition: () => ({ x: 20, y: 40 }),
      })
    ).toEqual({
      isOpen: true,
      code: 'flowchart TD\nA --> B',
      position: { x: 20, y: 40 },
      nodePos: 5,
      openSource: 'existing-node',
    });
  });
});
