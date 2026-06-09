import { describe, expect, it } from 'vitest';
import { normalizeSelectedFencedCodeIndent } from './blockSelectionSerializer';

describe('normalizeSelectedFencedCodeIndent', () => {
  it('strips shared fence indentation while preserving code indentation', () => {
    expect(normalizeSelectedFencedCodeIndent([
      '  ```ts',
      '  if (ok) {',
      '    console.log(1)',
      '  }',
      '  ```',
    ].join('\n'))).toBe([
      '```ts',
      'if (ok) {',
      '  console.log(1)',
      '}',
      '```',
    ].join('\n'));
  });

  it('keeps repeated unmatched fences on a bounded closing lookup path', () => {
    const markdown = [
      ...Array.from({ length: 500 }, (_value, index) => `  \`\`\`ts\n  unclosed ${index}`),
      '  ````ts',
      '  console.log(1)',
      '  ````',
    ].join('\n');

    expect(normalizeSelectedFencedCodeIndent(markdown)).toContain([
      '````ts',
      'console.log(1)',
      '````',
    ].join('\n'));
  });
});
