import { describe, expect, it } from 'vitest';
import { MERMAID_FENCE_LANGUAGE_ALIAS_LIST } from './mermaidLanguage';
import {
  createMermaidFenceStarterCode,
  normalizeMermaidEditorCodeInput,
  normalizeMermaidFenceCode,
} from './mermaidFenceCode';

describe('normalizeMermaidFenceCode', () => {
  it('adds the Mermaid sequence directive for legacy sequence fenced content', () => {
    expect(normalizeMermaidFenceCode('sequence', 'Alice->Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->Bob: Hello'
    );
  });

  it('does not duplicate an existing Mermaid diagram directive', () => {
    expect(normalizeMermaidFenceCode('sequence', 'sequenceDiagram\nAlice->>Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->>Bob: Hello'
    );
  });

  it('normalizes short diagram directives already present in the pasted code', () => {
    expect(normalizeMermaidFenceCode('mermaid', 'sequence\nAlice->Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->Bob: Hello'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'radar\ntitle Skills')).toBe(
      'radar-beta\ntitle Skills'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'treeView\nroot')).toBe(
      'treeView-beta\nroot'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'wardley\ntitle Value Chain')).toBe(
      'wardley-beta\ntitle Value Chain'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'zenuml\nAlice->Bob: Hi')).toBe(
      'zenuml\nAlice->Bob: Hi'
    );
  });

  it('normalizes short directives after Mermaid YAML frontmatter', () => {
    expect(normalizeMermaidFenceCode(
      'mermaid',
      ['---', 'title: Skills', '---', 'radar', 'axis A, B'].join('\n')
    )).toBe(['---', 'title: Skills', '---', 'radar-beta', 'axis A, B'].join('\n'));
  });

  it('leaves other Mermaid aliases unchanged', () => {
    expect(normalizeMermaidFenceCode('flowchart', 'flowchart TD\nA --> B')).toBe(
      'flowchart TD\nA --> B'
    );
  });

  it('does not rewrite explicit diagram direction or renderer directives', () => {
    expect(normalizeMermaidFenceCode('mermaid', 'flowchart LR\nA --> B')).toBe(
      'flowchart LR\nA --> B'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'graph BT\nA --> B')).toBe(
      'graph BT\nA --> B'
    );
    expect(normalizeMermaidFenceCode('mermaid', 'flowchart-elk TD\nA --> B')).toBe(
      'flowchart-elk TD\nA --> B'
    );
  });

  it('adds standard directives for supported alias fences without directives', () => {
    expect(normalizeMermaidFenceCode('flow', 'A --> B')).toBe('flowchart TD\nA --> B');
    expect(normalizeMermaidFenceCode('state', '[*] --> Still')).toBe(
      'stateDiagram-v2\n[*] --> Still'
    );
    expect(normalizeMermaidFenceCode('c4', 'Person(customer, "Customer")')).toBe(
      'C4Context\nPerson(customer, "Customer")'
    );
    expect(normalizeMermaidFenceCode('radar', 'title Skills')).toBe(
      'radar-beta\ntitle Skills'
    );
    expect(normalizeMermaidFenceCode('venn', 'A,B')).toBe('venn-beta\nA,B');
    expect(normalizeMermaidFenceCode('treeView', 'root')).toBe('treeView-beta\nroot');
    expect(normalizeMermaidFenceCode('wardley', 'title Value Chain')).toBe(
      'wardley-beta\ntitle Value Chain'
    );
  });
});

describe('createMermaidFenceStarterCode', () => {
  it('returns an editable starter directive for diagram fence aliases', () => {
    expect(createMermaidFenceStarterCode('sequence')).toBe('sequenceDiagram\n');
    expect(createMermaidFenceStarterCode('flow')).toBe('flowchart TD\n');
    expect(createMermaidFenceStarterCode('radar')).toBe('radar-beta\n');
    expect(createMermaidFenceStarterCode('zenuml')).toBe('zenuml\n');
  });

  it('does not add starter text for generic Mermaid fences', () => {
    expect(createMermaidFenceStarterCode('mermaid')).toBe('');
    expect(createMermaidFenceStarterCode('mmd')).toBe('');
  });

  it('keeps every Mermaid-specific fence alias wired to a starter directive', () => {
    for (const alias of MERMAID_FENCE_LANGUAGE_ALIAS_LIST) {
      if (alias === 'mermaid' || alias === 'mmd') {
        continue;
      }

      expect(createMermaidFenceStarterCode(alias), alias).not.toBe('');
    }
  });
});

describe('normalizeMermaidEditorCodeInput', () => {
  it('normalizes short leading directives in direct editor input', () => {
    expect(normalizeMermaidEditorCodeInput('sequence\nAlice->Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->Bob: Hello'
    );
    expect(normalizeMermaidEditorCodeInput('flowchart LR\nA --> B')).toBe(
      'flowchart LR\nA --> B'
    );
    expect(normalizeMermaidEditorCodeInput('A --> B')).toBe('A --> B');
  });

  it('strips a pasted Mermaid fence from the editor input and normalizes the code', () => {
    expect(normalizeMermaidEditorCodeInput(
      [
        '```sequence',
        'Alice->Bob: Hello Bob, how are you?',
        'Note right of Bob: Bob thinks',
        'Bob-->Alice: I am good thanks!',
        '```',
      ].join('\n')
    )).toBe([
      'sequenceDiagram',
      'Alice->Bob: Hello Bob, how are you?',
      'Note right of Bob: Bob thinks',
      'Bob-->Alice: I am good thanks!',
    ].join('\n'));
  });

  it('strips a pasted Mermaid fence with Markdown metadata', () => {
    expect(normalizeMermaidEditorCodeInput(
      ['```mermaid title="Flow"', 'flow', 'A --> B', '```'].join('\n')
    )).toBe(['flowchart TD', 'A --> B'].join('\n'));
  });

  it('keeps ZenUML pasted into the diagram editor as Mermaid diagram code', () => {
    expect(normalizeMermaidEditorCodeInput(
      [
        'zenuml',
        '    title Declare participant (optional)',
        '    Bob',
        '    Alice',
        '    Alice->Bob: Hi Bob',
        '    Bob->Alice: Hi Alice',
      ].join('\n')
    )).toBe([
      'zenuml',
      '    title Declare participant (optional)',
      '    Bob',
      '    Alice',
      '    Alice->Bob: Hi Bob',
      '    Bob->Alice: Hi Alice',
    ].join('\n'));
  });

  it('strips pasted Mermaid fences surrounded by blank edge lines without trimming code whitespace', () => {
    expect(normalizeMermaidEditorCodeInput(
      [' ', '```mermaid', '  flow', '  A --> B', '```', ''].join('\n')
    )).toBe(['  flowchart TD', '  A --> B'].join('\n'));
  });

  it('strips pasted Mermaid fences when the closing fence is longer than the opening fence', () => {
    expect(normalizeMermaidEditorCodeInput(
      ['```sequence', 'Alice->Bob: Hello', '````'].join('\n')
    )).toBe(['sequenceDiagram', 'Alice->Bob: Hello'].join('\n'));

    expect(normalizeMermaidEditorCodeInput(
      ['~~~flow', 'A --> B', '~~~~'].join('\n')
    )).toBe(['flowchart TD', 'A --> B'].join('\n'));
  });

  it('does not strip pasted Mermaid fences when the closing fence is shorter or uses the wrong marker', () => {
    expect(normalizeMermaidEditorCodeInput(
      ['````sequence', 'Alice->Bob: Hello', '```'].join('\n')
    )).toBe(['````sequence', 'Alice->Bob: Hello', '```'].join('\n'));

    expect(normalizeMermaidEditorCodeInput(
      ['```sequence', 'Alice->Bob: Hello', '~~~'].join('\n')
    )).toBe(['```sequence', 'Alice->Bob: Hello', '~~~'].join('\n'));
  });

  it('does not strip pasted Mermaid fences indented as code blocks', () => {
    expect(normalizeMermaidEditorCodeInput(
      ['    ```sequence', 'Alice->Bob: Hello', '    ```'].join('\n')
    )).toBe(['    ```sequence', 'Alice->Bob: Hello', '    ```'].join('\n'));
  });

  it('does not strip pasted backtick Mermaid fences with invalid info strings', () => {
    expect(normalizeMermaidEditorCodeInput(
      ['```mermaid `title`', 'flow', 'A --> B', '```'].join('\n')
    )).toBe(['```mermaid `title`', 'flow', 'A --> B', '```'].join('\n'));
  });

  it('leaves non-Mermaid fenced editor input untouched', () => {
    expect(normalizeMermaidEditorCodeInput('```ts\nconst x = 1;\n```')).toBe(
      '```ts\nconst x = 1;\n```'
    );
  });
});
