import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const syntaxVariables = [
  '--vlaina-markdown-color-code-text',
  '--vlaina-markdown-color-code-muted',
  '--vlaina-markdown-color-code-keyword',
  '--vlaina-markdown-color-code-name',
  '--vlaina-markdown-color-code-function',
  '--vlaina-markdown-color-code-constant',
  '--vlaina-markdown-color-code-type',
  '--vlaina-markdown-color-code-operator',
  '--vlaina-markdown-color-code-string',
  '--vlaina-markdown-color-code-variable',
  '--vlaina-markdown-color-code-tag',
  '--vlaina-markdown-color-code-markup',
  '--vlaina-markdown-color-code-list',
  '--vlaina-markdown-color-code-invalid',
];

describe('shared code block theme', () => {
  it('keeps Chat code blocks on the shared vlaina code theme instead of a bundled highlight.js theme', () => {
    const chatCodeBlock = readProjectFile('src/components/Chat/features/Markdown/components/CodeBlock.tsx');
    const sharedChrome = readProjectFile('src/components/common/code-block/codeBlockChrome.css');

    expect(chatCodeBlock).not.toContain('highlight.js/styles');
    expect(chatCodeBlock).toContain('@/components/common/code-block');
    expect(sharedChrome).toContain('--vlaina-markdown-color-code-block-bg');
    expect(sharedChrome).toContain('.code-block-chrome-copy-button {');
    expect(sharedChrome).toContain('opacity: var(--vlaina-opacity-0);');
    expect(sharedChrome).toContain('pointer-events: none;');
    expect(sharedChrome).toContain('.code-block-chrome:hover .code-block-chrome-copy-button,');
    expect(sharedChrome).toContain('.code-block-chrome:focus-within .code-block-chrome-copy-button,');
    expect(sharedChrome).toContain('.code-block-chrome-copy-button[data-copied="true"] {');
    expect(sharedChrome).toContain('opacity: var(--vlaina-opacity-100);');
    expect(sharedChrome).toContain('pointer-events: auto;');

    for (const variable of syntaxVariables) {
      expect(sharedChrome).toContain(variable);
    }
  });

  it('keeps Notes CodeMirror highlighting on the same shared syntax variables', () => {
    const notesHeader = readProjectFile(
      'src/components/Notes/features/Editor/plugins/code/components/CodeBlockHeader.tsx'
    );
    const notesEditorTheme = readProjectFile(
      'src/components/Notes/features/Editor/plugins/code/codemirror/codeBlockEditorTheme.ts'
    );
    const notesHighlightStyle = readProjectFile(
      'src/components/Notes/features/Editor/plugins/code/codemirror/codeBlockHighlightStyle.ts'
    );

    expect(notesHeader).toContain('@/components/common/code-block');
    expect(notesEditorTheme).toContain('codeBlockHighlightStyle');
    expect(notesEditorTheme).not.toContain('oneDarkTheme');
    expect(notesHighlightStyle).not.toContain('oneDarkHighlightStyle');
    expect(notesHighlightStyle).toContain('githubSyntax');

    for (const variable of syntaxVariables) {
      expect(notesHighlightStyle).toContain(variable);
    }
  });
});
