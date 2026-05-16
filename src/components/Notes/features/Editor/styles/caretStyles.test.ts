import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readIndexStyles() {
  return readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
}

function readEditorCoreStyles() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/core.css'),
    'utf8'
  );
}

describe('caret styles', () => {
  it('uses a shared global caret color token', () => {
    const css = readIndexStyles();

    expect(css).toContain('--vlaina-color-caret: #41ace2;');
    expect(css).toContain('--vlaina-caret-color: var(--vlaina-color-caret);');
    expect(css).toContain('--vlaina-caret-width: 1px;');
    expect(css).toContain("[contenteditable='true'] {");
    expect(css).toContain('caret-color: var(--vlaina-caret-color);');
  });

  it('keeps the editor caret sourced from the shared caret token', () => {
    const css = readEditorCoreStyles();

    expect(css).toContain('--vlaina-editor-caret-color: var(--vlaina-caret-color, #41ace2);');
    expect(css).toContain('--vlaina-editor-caret-width: var(--vlaina-caret-width, 1px);');
    expect(css).toContain('caret-color: var(--vlaina-editor-caret-color);');
  });
});
