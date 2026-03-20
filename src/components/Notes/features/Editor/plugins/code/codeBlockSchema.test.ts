import { describe, expect, it } from 'vitest';
import {
  parseCodeBlockElementAttrs,
  serializeCodeBlockNode,
} from './codeBlockSchema';

describe('codeBlockSchema', () => {
  it('normalizes parsed DOM attrs from code class names', () => {
    const pre = document.createElement('pre');
    pre.dataset.lineNumbers = 'false';
    pre.dataset.wrap = 'true';
    pre.dataset.collapsed = 'true';

    const code = document.createElement('code');
    code.className = 'language-JS';
    pre.appendChild(code);

    expect(parseCodeBlockElementAttrs(pre)).toEqual({
      language: 'ecmascript',
      lineNumbers: false,
      wrap: true,
      collapsed: true,
    });
  });

  it('prefers explicit data-language when present', () => {
    const pre = document.createElement('pre');
    pre.dataset.language = 'TS';

    const code = document.createElement('code');
    code.className = 'language-js';
    pre.appendChild(code);

    expect(parseCodeBlockElementAttrs(pre).language).toBe('ts');
  });

  it('serializes canonical attrs back to DOM spec', () => {
    const spec = serializeCodeBlockNode({
      attrs: {
        language: 'typescript',
        lineNumbers: true,
        wrap: false,
        collapsed: false,
      },
    } as never);

    expect(spec).toEqual([
      'pre',
      {
        'data-language': 'typescript',
        'data-line-numbers': 'true',
        'data-wrap': 'false',
        'data-collapsed': 'false',
        class: 'code-block-wrapper',
      },
      ['code', { class: 'language-typescript' }, 0],
    ]);
  });
});
