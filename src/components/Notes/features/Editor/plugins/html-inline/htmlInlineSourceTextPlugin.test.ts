import { describe, expect, it } from 'vitest';
import {
  collectHtmlInlineSourceTextDecorations,
} from './htmlInlineSourceTextPlugin';

function createTextNode(text: string, marks: Array<{ type: { name: string } }> = []) {
  return {
    isText: true,
    marks,
    nodeSize: text.length,
    text,
    type: { name: 'text' },
  };
}

function createNode(typeName: string, children: any[]) {
  return {
    child: (index: number) => children[index],
    childCount: children.length,
    nodeSize: children.reduce((sum, child) => sum + child.nodeSize, 2),
    type: { name: typeName },
  };
}

describe('htmlInlineSourceTextPlugin', () => {
  it('decorates literal inline HTML tags while skipping code', () => {
    const text = 'Example <video src="xxx.mp4" /> tail';
    const inlineCodeText = '<span>code</span>';
    const codeBlockText = '<audio src="demo.mp3" />';
    const paragraph = createNode('paragraph', [
      createTextNode(text),
      createTextNode(inlineCodeText, [{ type: { name: 'inlineCode' } }]),
    ]);
    const codeBlock = createNode('code_block', [
      createTextNode(codeBlockText),
    ]);
    const doc = createNode('doc', [paragraph, codeBlock]);

    const decorations = collectHtmlInlineSourceTextDecorations(doc as any);

    expect(decorations).toHaveLength(1);
    expect(decorations[0].from).toBe(1 + text.indexOf('<video'));
    expect(decorations[0].to).toBe(1 + text.indexOf(' />') + 3);
    expect((decorations[0].type as any).attrs?.class).toBe('md-html-inline md-html-source-text');
  });

  it('bounds decoration collection', () => {
    const doc = {
      childCount: 1,
      child: () => ({
        isText: true,
        marks: [],
        nodeSize: 24,
        text: '<video src="a.mp4" />',
        type: { name: 'text' },
      }),
      type: { name: 'doc' },
    };

    expect(collectHtmlInlineSourceTextDecorations(doc as any, 0)).toHaveLength(0);
  });
});
