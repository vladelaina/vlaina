import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readIndexStyles() {
  return readFileSync(new URL('../../../../../index.css', import.meta.url), 'utf8');
}

function readEditorCoreStyles() {
  return readFileSync(new URL('./core.css', import.meta.url), 'utf8');
}

function readEditorThemeSource() {
  return readFileSync(new URL('../theme.ts', import.meta.url), 'utf8');
}

describe('caret styles', () => {
  it('uses a shared global caret color token', () => {
    const css = readIndexStyles();

    expect(css).toContain('--vlaina-caret-color: #41ace2;');
    expect(css).toContain("[contenteditable='true'] {");
    expect(css).toContain('caret-color: var(--vlaina-caret-color);');
  });

  it('keeps the editor caret sourced from the shared caret token', () => {
    const css = readEditorCoreStyles();
    const theme = readEditorThemeSource();

    expect(css).toContain('--vlaina-editor-caret-color: var(--vlaina-caret-color, #41ace2);');
    expect(theme).toContain('caret-[var(--vlaina-caret-color)]');
  });
});
