import { describe, expect, it } from 'vitest';
import { createClosedMermaidEditorState } from './mermaidEditorState';
import {
  getMermaidAnchorViewportPosition,
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
