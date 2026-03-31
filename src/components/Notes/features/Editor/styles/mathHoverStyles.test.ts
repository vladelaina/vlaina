import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readMathStyles() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/math-editor.css'),
    'utf8'
  );
}

describe('math hover styles', () => {
  it('keeps clickable hover affordances for inline and block math nodes', () => {
    const css = readMathStyles();

    expect(css).toContain(".milkdown [data-type='math-inline'],");
    expect(css).toContain(".milkdown [data-type='math-block'] {");
    expect(css).toContain('--vlaina-math-hover-color: var(--vlaina-hover-filled);');
    expect(css).toContain('--vlaina-math-hover-bleed-y: 4px;');
    expect(css).toContain('box-decoration-break: clone;');
    expect(css).toContain(".milkdown [data-type='math-inline']:hover,");
    expect(css).toContain('background: var(--vlaina-math-hover-color);');
    expect(css).toContain('inset 0 0 0 1px var(--vlaina-math-hover-color),');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('cursor: pointer !important;');
  });
});
