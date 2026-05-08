import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const syntaxVariables = [
  '--vlaina-code-syntax-foreground',
  '--vlaina-code-syntax-muted',
  '--vlaina-code-syntax-keyword',
  '--vlaina-code-syntax-name',
  '--vlaina-code-syntax-function',
  '--vlaina-code-syntax-constant',
  '--vlaina-code-syntax-type',
  '--vlaina-code-syntax-operator',
  '--vlaina-code-syntax-string',
  '--vlaina-code-syntax-invalid',
];

describe('shared code block theme', () => {
  it('keeps Chat code blocks on the shared vlaina code theme instead of a bundled highlight.js theme', () => {
    const chatCodeBlock = readProjectFile('src/components/Chat/features/Markdown/components/CodeBlock.tsx');
    const sharedChrome = readProjectFile('src/components/common/code-block/codeBlockChrome.css');

    expect(chatCodeBlock).not.toContain('highlight.js/styles');
    expect(chatCodeBlock).toContain('@/components/common/code-block');
    expect(sharedChrome).toContain('--vlaina-code-block-background');
    expect(sharedChrome).toContain('.vlaina-code-block-copy-button {');
    expect(sharedChrome).toContain('opacity: 0;');
    expect(sharedChrome).toContain('pointer-events: none;');
    expect(sharedChrome).toContain('.vlaina-code-block:hover .vlaina-code-block-copy-button,');
    expect(sharedChrome).toContain('.vlaina-code-block:focus-within .vlaina-code-block-copy-button,');
    expect(sharedChrome).toContain('.vlaina-code-block-copy-button[data-copied="true"] {');
    expect(sharedChrome).toContain('opacity: 1;');
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
    expect(notesEditorTheme).toContain('vlainaCodeBlockHighlightStyle');
    expect(notesEditorTheme).not.toContain('syntaxHighlighting(oneDarkHighlightStyle)');
    expect(notesHighlightStyle).toContain('oneDarkHighlightStyle.specs.map');

    for (const variable of syntaxVariables) {
      expect(notesHighlightStyle).toContain(variable);
    }
  });
});
