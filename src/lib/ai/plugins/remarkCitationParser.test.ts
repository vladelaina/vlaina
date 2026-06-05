import { describe, expect, it } from 'vitest';

import remarkCitationParser from './remarkCitationParser';

function runCitationParser(value: string) {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value }],
      },
    ],
  };

  remarkCitationParser()(tree);
  return tree.children[0].children;
}

describe('remarkCitationParser', () => {
  it('parses line citations', () => {
    expect(runCitationParser('See \u301012\u2020L3-L4\u3011 now.')).toEqual([
      { type: 'text', value: 'See ' },
      {
        type: 'custom-citation',
        data: {
          hName: 'ol-citation',
          hProperties: {
            cursor: '12',
            start: '3',
            end: '4',
          },
        },
      },
      { type: 'text', value: ' now.' },
    ]);
  });

  it('caps citations split from one text node', () => {
    const children = runCitationParser(
      Array.from({ length: 250 }, (_, index) => `\u3010${index}\u2020source\u3011`).join('')
    );

    expect(children.filter((child: any) => child.type === 'custom-citation')).toHaveLength(200);
    expect(children.at(-1)).toEqual({
      type: 'text',
      value: Array.from({ length: 50 }, (_, index) => `\u3010${index + 200}\u2020source\u3011`).join(''),
    });
  });

  it('leaves oversized text nodes unchanged', () => {
    const value = `${'x'.repeat(256 * 1024 + 1)}`;

    expect(runCitationParser(value)).toEqual([{ type: 'text', value }]);
  });
});
