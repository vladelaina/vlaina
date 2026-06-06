import { describe, expect, it } from 'vitest';
import {
  SKIP_PROSE_DESCENDANTS,
  STOP_PROSE_SCAN,
  scanProseDescendants,
  type BoundedProseScanNode,
} from './boundedProseNodeScan';

function textNode(text: string): BoundedProseScanNode {
  return {
    isText: true,
    nodeSize: text.length,
    text,
    type: { name: 'text' },
  };
}

function blockNode(type: string, children: BoundedProseScanNode[] = []): BoundedProseScanNode {
  return {
    child: (index) => children[index],
    childCount: children.length,
    content: {
      size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
    },
    isBlock: true,
    nodeSize: children.reduce((size, child) => size + (child.nodeSize ?? 1), 2),
    type: { name: type },
  };
}

function docNode(children: BoundedProseScanNode[]): BoundedProseScanNode {
  return {
    child: (index) => children[index],
    childCount: children.length,
    content: {
      size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
    },
    type: { name: 'doc' },
  };
}

describe('scanProseDescendants', () => {
  it('matches ProseMirror descendant positions for nested content', () => {
    const visited: Array<{ pos: number; type?: string }> = [];
    const doc = docNode([
      blockNode('paragraph', [textNode('one')]),
      blockNode('paragraph', [textNode('two')]),
    ]);

    scanProseDescendants(doc, (node, pos) => {
      visited.push({ pos, type: node.type?.name });
    });

    expect(visited).toEqual([
      { pos: 0, type: 'paragraph' },
      { pos: 1, type: 'text' },
      { pos: 5, type: 'paragraph' },
      { pos: 6, type: 'text' },
    ]);
  });

  it('can skip a node subtree without stopping later siblings', () => {
    const visited: string[] = [];
    const doc = docNode([
      blockNode('paragraph', [textNode('skip')]),
      blockNode('paragraph', [textNode('keep')]),
    ]);

    scanProseDescendants(doc, (node) => {
      visited.push(node.text ?? node.type?.name ?? '');
      if (node.type?.name === 'paragraph') {
        return SKIP_PROSE_DESCENDANTS;
      }
    });

    expect(visited).toEqual(['paragraph', 'paragraph']);
  });

  it('stops the full scan when requested', () => {
    const visited: string[] = [];
    const doc = docNode([
      textNode('one'),
      textNode('two'),
    ]);

    scanProseDescendants(doc, (node) => {
      visited.push(node.text ?? '');
      return STOP_PROSE_SCAN;
    });

    expect(visited).toEqual(['one']);
  });

  it('reports exhaustion when the node budget is reached', () => {
    const visited: string[] = [];
    const doc = docNode([
      textNode('one'),
      textNode('two'),
    ]);

    const complete = scanProseDescendants(doc, (node) => {
      visited.push(node.text ?? '');
    }, 1);

    expect(complete).toBe(false);
    expect(visited).toEqual(['one']);
  });
});
