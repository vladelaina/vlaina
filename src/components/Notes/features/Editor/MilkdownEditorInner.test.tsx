import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import * as ProseModel from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import {
  MilkdownEditorInner,
  createLargePlainMarkdownDocJSON,
  isEditorMarkdownEquivalentToNoteContent,
  normalizeInitialEditorSelection,
  replaceEditorMarkdown,
  shouldUseLazyBlockVisibility,
} from './MilkdownEditorInner';
import { createDocumentStartTextSelection } from './utils/editorSelection';
import {
  blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION,
} from './plugins/cursor/blockSelectionPluginState';

const mocks = vi.hoisted(() => {
  const notesState = {
    currentNote: { path: 'small.md', content: '# Small' } as { path: string; content: string } | null,
    currentNoteDiskRevision: 1,
    updateContent: vi.fn(),
    saveNote: vi.fn().mockResolvedValue(undefined),
    isNewlyCreated: false,
    notesPath: '/vault',
  };
  const editorState = {
    activeEditor: null as any,
    serializedMarkdown: '# Small',
  };

  return { editorState, notesState };
});

vi.mock('@milkdown/react', () => ({
  MilkdownProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Milkdown: () => <div data-testid="milkdown-runtime" />,
  useEditor: () => ({ get: () => mocks.editorState.activeEditor }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
    {
      getState: () => mocks.notesState,
      subscribe: () => () => {},
    },
  ),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: (selector: (state: {
    data: {
      settings: {
        markdown: {
          appearance: { importedThemeId: null };
          typewriterMode: boolean;
        };
      };
    };
  }) => unknown) => selector({
    data: {
      settings: {
        markdown: {
          appearance: { importedThemeId: null },
          typewriterMode: false,
        },
      },
    },
  }),
}));

vi.mock('@/components/markdown-theme/useImportedMarkdownThemePlatform', () => ({
  useImportedMarkdownThemePlatform: () => null,
}));

vi.mock('./hooks/useEditorSave', () => ({
  useEditorSave: () => ({
    debouncedSave: vi.fn(),
    flushSave: vi.fn(),
  }),
}));

vi.mock('./hooks/usePendingMarkdownAutosave', () => ({
  usePendingMarkdownAutosave: () => ({
    configureMarkdownListener: () => () => {},
    createUserInputMarker: () => () => {},
    setEditorGetter: vi.fn(),
  }),
}));

const ProseSchema = (ProseModel as unknown as {
  Schema: new (spec: Record<string, unknown>) => {
    node: (type: string, attrs?: unknown, content?: unknown) => any;
    nodes: Record<string, any>;
    text: (text: string) => any;
  };
}).Schema;

function createContext(parser: (markdown: string) => unknown) {
  const dispatch = vi.fn();
  const replace = vi.fn(() => ({ step: 'replace' }));
  const nodeFromJSON = vi.fn((json: unknown) => ({
    content: { type: 'fast-doc-content', json },
  }));
  const view = {
    dispatch,
    state: {
      schema: { nodeFromJSON },
      doc: { content: { size: 12 } },
      tr: { replace },
    },
  };
  const ctx = {
    get: vi.fn((token: unknown) => {
      if (token === editorViewCtx) return view;
      if (token === parserCtx) return parser;
      throw new Error('Unexpected token');
    }),
  };

  return { ctx, dispatch, nodeFromJSON, replace, view };
}

function createLargePlainMarkdown(): string {
  return [
    '# Large Fast Path',
    '',
    ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
  ].join('\n\n');
}

function createTextSchema(options: { blankLine?: boolean } = {}) {
  const nodes: Record<string, unknown> = {
    doc: { content: 'block+' },
    paragraph: {
      content: 'text*',
      group: 'block',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
  };

  if (options.blankLine) {
    nodes.blank_line = {
      group: 'block',
      atom: true,
      toDOM: () => ['div', { 'data-blank-line': 'true' }],
      parseDOM: [{ tag: 'div[data-blank-line="true"]' }],
    };
  }

  return new ProseSchema({ nodes });
}

function createMockActiveEditor() {
  const dispatch = vi.fn();
  const replace = vi.fn(() => ({ step: 'replace' }));
  const parser = vi.fn((markdown: string) => ({ content: { type: 'parsed-doc-content', markdown } }));
  const view = {
    dom: document.createElement('div'),
    dispatch,
    state: {
      doc: { content: { size: 12 } },
      tr: { replace },
    },
  };
  const ctx = {
    get: vi.fn((token: unknown) => {
      if (token === editorViewCtx) return view;
      if (token === parserCtx) return parser;
      if (token === serializerCtx) return () => mocks.editorState.serializedMarkdown;
      throw new Error('Unexpected token');
    }),
  };
  const action = vi.fn((callback: (ctx: unknown) => unknown) => callback(ctx));
  const editor = { action, ctx };
  mocks.editorState.activeEditor = editor;
  return { action, dispatch, parser, replace };
}

beforeEach(() => {
  mocks.notesState.currentNote = { path: 'small.md', content: '# Small' };
  mocks.notesState.currentNoteDiskRevision = 1;
  mocks.notesState.updateContent.mockClear();
  mocks.notesState.saveNote.mockClear();
  mocks.notesState.isNewlyCreated = false;
  mocks.notesState.notesPath = '/vault';
  mocks.editorState.activeEditor = null;
  mocks.editorState.serializedMarkdown = '# Small';
});

afterEach(() => {
  cleanup();
});

describe('replaceEditorMarkdown', () => {
  it('returns false without dispatching when the parser throws', () => {
    const { ctx, dispatch, replace } = createContext(() => {
      throw new Error('parse failed');
    });

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false without dispatching when the parser cannot create a document', () => {
    const { ctx, dispatch, replace } = createContext(() => null);

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a document replacement only after parsing succeeds', () => {
    const doc = { content: { type: 'doc-content' } };
    const { ctx, dispatch, replace } = createContext(() => doc);

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(true);
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: doc.content,
    }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('preserves selection position when replacing same-note content', () => {
    const schema = createTextSchema();
    const currentDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Alpha Beta Gamma')),
    ]);
    const replacementDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Alpha Beta Gamma saved')),
    ]);
    const parserDoc = { content: replacementDoc.content };
    const setSelection = vi.fn(function setSelection(this: unknown, _selection: unknown) {
      return transaction;
    });
    const transaction = {
      doc: replacementDoc,
      setSelection,
    };
    const dispatch = vi.fn();
    const replace = vi.fn(() => transaction);
    const view = {
      dispatch,
      state: {
        schema,
        doc: currentDoc,
        selection: TextSelection.create(currentDoc, 8),
        tr: { replace },
      },
    };
    const ctx = {
      get: vi.fn((token: unknown) => {
        if (token === editorViewCtx) return view;
        if (token === parserCtx) return () => parserDoc;
        throw new Error('Unexpected token');
      }),
    };

    expect(replaceEditorMarkdown(ctx as never, 'replacement')).toBe(true);

    const selection = setSelection.mock.calls[0]?.[0];
    expect(selection).toBeInstanceOf(TextSelection);
    expect((selection as TextSelection).from).toBe(8);
    expect((selection as TextSelection).to).toBe(8);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('preserves a selected text range when replacing same-note content', () => {
    const schema = createTextSchema();
    const currentDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Alpha Beta Gamma')),
    ]);
    const replacementDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Alpha Beta Gamma saved')),
    ]);
    const parserDoc = { content: replacementDoc.content };
    const setSelection = vi.fn(function setSelection(this: unknown, _selection: unknown) {
      return transaction;
    });
    const transaction = {
      doc: replacementDoc,
      setSelection,
    };
    const dispatch = vi.fn();
    const replace = vi.fn(() => transaction);
    const view = {
      dispatch,
      state: {
        schema,
        doc: currentDoc,
        selection: TextSelection.create(currentDoc, 7, 11),
        tr: { replace },
      },
    };
    const ctx = {
      get: vi.fn((token: unknown) => {
        if (token === editorViewCtx) return view;
        if (token === parserCtx) return () => parserDoc;
        throw new Error('Unexpected token');
      }),
    };

    expect(replaceEditorMarkdown(ctx as never, 'replacement')).toBe(true);

    const selection = setSelection.mock.calls[0]?.[0];
    expect(selection).toBeInstanceOf(TextSelection);
    expect((selection as TextSelection).from).toBe(7);
    expect((selection as TextSelection).to).toBe(11);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('clamps a preserved same-note cursor when the replacement document is shorter', () => {
    const schema = createTextSchema();
    const currentDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('A much longer paragraph before autosave normalization')),
    ]);
    const replacementDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Short')),
    ]);
    const parserDoc = { content: replacementDoc.content };
    const setSelection = vi.fn(function setSelection(this: unknown, _selection: unknown) {
      return transaction;
    });
    const transaction = {
      doc: replacementDoc,
      setSelection,
    };
    const dispatch = vi.fn();
    const replace = vi.fn(() => transaction);
    const view = {
      dispatch,
      state: {
        schema,
        doc: currentDoc,
        selection: TextSelection.create(currentDoc, currentDoc.content.size - 1),
        tr: { replace },
      },
    };
    const ctx = {
      get: vi.fn((token: unknown) => {
        if (token === editorViewCtx) return view;
        if (token === parserCtx) return () => parserDoc;
        throw new Error('Unexpected token');
      }),
    };

    expect(replaceEditorMarkdown(ctx as never, 'replacement')).toBe(true);

    const selection = setSelection.mock.calls[0]?.[0] as TextSelection;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.from).toBeLessThanOrEqual(replacementDoc.content.size);
    expect(selection.to).toBeLessThanOrEqual(replacementDoc.content.size);
    expect(selection.empty).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('falls back to a nearby cursor when a same-note atomic block selection cannot be preserved as text', () => {
    const schema = createTextSchema({ blankLine: true });
    const currentDoc = schema.node('doc', null, [
      schema.nodes.blank_line.create(),
      schema.nodes.paragraph.create(null, schema.text('After atomic block')),
    ]);
    const replacementDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('After atomic block')),
    ]);
    const parserDoc = { content: replacementDoc.content };
    const setSelection = vi.fn(function setSelection(this: unknown, _selection: unknown) {
      return transaction;
    });
    const transaction = {
      doc: replacementDoc,
      setSelection,
    };
    const dispatch = vi.fn();
    const replace = vi.fn(() => transaction);
    const view = {
      dispatch,
      state: {
        schema,
        doc: currentDoc,
        selection: NodeSelection.create(currentDoc, 0),
        tr: { replace },
      },
    };
    const ctx = {
      get: vi.fn((token: unknown) => {
        if (token === editorViewCtx) return view;
        if (token === parserCtx) return () => parserDoc;
        throw new Error('Unexpected token');
      }),
    };

    expect(replaceEditorMarkdown(ctx as never, 'replacement')).toBe(true);

    const selection = setSelection.mock.calls[0]?.[0];
    expect(selection).toBeInstanceOf(TextSelection);
    expect((selection as TextSelection).from).toBe(1);
    expect((selection as TextSelection).empty).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  it('uses the large plain markdown fast document path without calling the parser', () => {
    const parser = vi.fn(() => {
      throw new Error('parser should not run');
    });
    const { ctx, dispatch, nodeFromJSON, replace } = createContext(parser);
    const markdown = [
      '# Large Fast Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(replaceEditorMarkdown(ctx as never, markdown)).toBe(true);
    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(parser).not.toHaveBeenCalled();
    expect(nodeFromJSON).toHaveBeenCalledWith(expect.objectContaining({
      type: 'doc',
      content: expect.arrayContaining([
        expect.objectContaining({ type: 'heading' }),
        expect.objectContaining({ type: 'paragraph' }),
      ]),
    }));
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: expect.objectContaining({ type: 'fast-doc-content' }),
    }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the parser for complex large markdown', () => {
    const doc = { content: { type: 'parsed-doc-content' } };
    const parser = vi.fn(() => doc);
    const { ctx, nodeFromJSON, replace } = createContext(parser);
    const markdown = [
      '# Large Complex Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} with [a link](https://example.com) ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(replaceEditorMarkdown(ctx as never, markdown)).toBe(true);
    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(nodeFromJSON).not.toHaveBeenCalled();
    expect(parser).toHaveBeenCalledWith(markdown);
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: doc.content,
    }));
  });

  it('resets selection and clears block selection when replacing a different note', () => {
    const schema = createTextSchema({ blankLine: true });
    const currentDoc = schema.node('doc', null, [
      schema.nodes.paragraph.create(null, schema.text('Previous note body')),
    ]);
    const replacementDoc = schema.node('doc', null, [
      schema.nodes.blank_line.create(),
      schema.nodes.paragraph.create(null, schema.text('After leading blank line')),
    ]);
    const parserDoc = { content: replacementDoc.content };
    const setSelection = vi.fn(function setSelection(this: unknown, _selection: unknown) {
      return transaction;
    });
    const setMeta = vi.fn(function setMeta(this: unknown, _key: unknown, _value: unknown) {
      return transaction;
    });
    const transaction = {
      doc: replacementDoc,
      setSelection,
      setMeta,
    };
    const dispatch = vi.fn();
    const replace = vi.fn(() => transaction);
    const view = {
      dispatch,
      state: {
        schema,
        doc: currentDoc,
        selection: TextSelection.create(currentDoc, currentDoc.content.size - 1),
        tr: { replace },
      },
    };
    const ctx = {
      get: vi.fn((token: unknown) => {
        if (token === editorViewCtx) return view;
        if (token === parserCtx) return () => parserDoc;
        throw new Error('Unexpected token');
      }),
    };

    expect(replaceEditorMarkdown(ctx as never, 'replacement', { resetSelection: true })).toBe(true);

    const selection = setSelection.mock.calls[0]?.[0];
    expect(selection).toBeInstanceOf(TextSelection);
    expect((selection as TextSelection).from).toBe(2);
    expect(setMeta).toHaveBeenCalledWith(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });
});

describe('isEditorMarkdownEquivalentToNoteContent', () => {
  it('treats managed-only frontmatter changes as equivalent to the visible editor markdown', () => {
    expect(
      isEditorMarkdownEquivalentToNoteContent(
        '# Body',
        [
          '---',
          'vlaina_cover: asset="./assets/readme.gif" x=50 y=50 height=255 scale=1',
          'vlaina_icon: value="sparkles" size=84',
          '---',
          '',
          '# Body',
        ].join('\n'),
      )
    ).toBe(true);
  });

  it('keeps user-authored frontmatter differences visible when comparing editor markdown', () => {
    expect(
      isEditorMarkdownEquivalentToNoteContent(
        [
          '```yaml-frontmatter vlaina-internal-frontmatter',
          'title: Demo',
          '```',
          '# Body',
        ].join('\n'),
        [
          '---',
          'title: Changed',
          'vlaina_cover: asset="./assets/readme.gif" x=50 y=50 height=255 scale=1',
          '---',
          '# Body',
        ].join('\n'),
      )
    ).toBe(false);
  });
});

describe('MilkdownEditorInner lazy block visibility', () => {
  it('recomputes lazy block visibility when switching to a large plain note', () => {
    const { container, rerender } = render(<MilkdownEditorInner />);
    const getShell = () => container.querySelector<HTMLElement>('[data-note-content-root="true"]');

    expect(getShell()?.getAttribute('data-note-lazy-block-visibility')).toBeNull();

    mocks.notesState.currentNote = { path: 'large.md', content: createLargePlainMarkdown() };
    mocks.notesState.currentNoteDiskRevision = 2;
    rerender(<MilkdownEditorInner showBodyLineNumbers />);

    expect(getShell()?.getAttribute('data-note-lazy-block-visibility')).toBe('true');
  });

  it('recomputes lazy block visibility when same-revision note content becomes complex markdown', () => {
    const plainMarkdown = createLargePlainMarkdown();
    mocks.notesState.currentNote = { path: 'large.md', content: plainMarkdown };
    mocks.notesState.currentNoteDiskRevision = 2;
    const { container, rerender } = render(<MilkdownEditorInner />);
    const getShell = () => container.querySelector<HTMLElement>('[data-note-content-root="true"]');

    expect(getShell()?.getAttribute('data-note-lazy-block-visibility')).toBe('true');

    mocks.notesState.currentNote = {
      path: 'large.md',
      content: plainMarkdown.replace('Paragraph 100', 'Paragraph [100](https://example.com)'),
    };
    rerender(<MilkdownEditorInner showBodyLineNumbers />);

    expect(getShell()?.getAttribute('data-note-lazy-block-visibility')).toBeNull();
  });
});

describe('MilkdownEditorInner external content sync', () => {
  it('does not replace the editor document when same-note updates only change managed frontmatter', () => {
    mocks.notesState.currentNote = { path: 'small.md', content: '# Body' };
    mocks.editorState.serializedMarkdown = '# Body';
    const editor = createMockActiveEditor();
    const { rerender } = render(<MilkdownEditorInner />);

    expect(editor.replace).not.toHaveBeenCalled();

    mocks.notesState.currentNote = {
      path: 'small.md',
      content: [
        '---',
        'vlaina_cover: asset="./assets/readme.gif" x=50 y=50 height=255 scale=1',
        '---',
        '',
        '# Body',
      ].join('\n'),
    };
    rerender(<MilkdownEditorInner showBodyLineNumbers />);

    expect(editor.parser).not.toHaveBeenCalled();
    expect(editor.replace).not.toHaveBeenCalled();
    expect(editor.dispatch).not.toHaveBeenCalled();
  });

  it('does not replace the editor document when managed frontmatter is removed from the same note', () => {
    mocks.notesState.currentNote = {
      path: 'small.md',
      content: [
        '---',
        'vlaina_cover: asset="./assets/readme.gif" x=50 y=50 height=255 scale=1',
        'vlaina_icon: value="sparkles" size=84',
        '---',
        '',
        '# Body',
      ].join('\n'),
    };
    mocks.editorState.serializedMarkdown = '# Body';
    const editor = createMockActiveEditor();
    const { rerender } = render(<MilkdownEditorInner />);

    expect(editor.replace).not.toHaveBeenCalled();

    mocks.notesState.currentNote = { path: 'small.md', content: '# Body' };
    rerender(<MilkdownEditorInner showBodyLineNumbers />);

    expect(editor.parser).not.toHaveBeenCalled();
    expect(editor.replace).not.toHaveBeenCalled();
    expect(editor.dispatch).not.toHaveBeenCalled();
  });

  it('replaces same-revision store content when the editor still has stale startup markdown', () => {
    const editor = createMockActiveEditor();
    const { rerender } = render(<MilkdownEditorInner />);

    expect(editor.replace).not.toHaveBeenCalled();

    mocks.notesState.currentNote = { path: 'small.md', content: '# Updated' };
    rerender(<MilkdownEditorInner showBodyLineNumbers />);

    expect(editor.parser).toHaveBeenCalledWith('# Updated');
    expect(editor.replace).toHaveBeenCalledTimes(1);
    expect(editor.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('createDocumentStartTextSelection', () => {
  it('skips a leading atomic block and places the cursor in the first text block', () => {
    const schema = new ProseSchema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'text*',
          group: 'block',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        atom_block: {
          group: 'block',
          atom: true,
          toDOM: () => ['div'],
          parseDOM: [{ tag: 'div' }],
        },
      },
    });
    const doc = schema.node('doc', null, [
      schema.nodes.atom_block.create(),
      schema.nodes.paragraph.create(null, schema.text('First editable block')),
    ]);

    const selection = createDocumentStartTextSelection(doc);

    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.from).toBe(2);
    expect(selection.empty).toBe(true);
  });
});

describe('normalizeInitialEditorSelection', () => {
  it('moves an initial atomic node selection into the first editable text block', () => {
    const schema = new ProseSchema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'text*',
          group: 'block',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        atom_block: {
          group: 'block',
          atom: true,
          selectable: true,
          toDOM: () => ['div'],
          parseDOM: [{ tag: 'div' }],
        },
      },
    });
    const doc = schema.node('doc', null, [
      schema.nodes.atom_block.create(),
      schema.nodes.paragraph.create(null, schema.text('First editable block')),
    ]);
    const transaction = {
      setSelection: vi.fn(function setSelection(_selection: unknown) {
        return transaction;
      }),
      setMeta: vi.fn(function setMeta(_key: unknown, _value: unknown) {
        return transaction;
      }),
    };
    const view = {
      dispatch: vi.fn(),
      state: {
        doc,
        selection: NodeSelection.create(doc, 0),
        tr: transaction,
      },
    };

    expect(normalizeInitialEditorSelection(view as never)).toBe(true);

    const nextSelection = transaction.setSelection.mock.calls[0]?.[0];
    expect(nextSelection).toBeInstanceOf(TextSelection);
    expect((nextSelection as TextSelection).from).toBe(2);
    expect(transaction.setMeta).toHaveBeenCalledWith(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
  });
});

describe('createLargePlainMarkdownDocJSON', () => {
  it('creates ProseMirror JSON for large headings, paragraphs, and blank line placeholders', () => {
    const markdown = [
      '# Large Fast Path',
      '',
      '<!--vlaina-markdown-blank-line-->',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    const doc = createLargePlainMarkdownDocJSON(markdown);
    expect(doc?.type).toBe('doc');
    expect(doc?.content?.length).toBe(1102);
    expect(doc?.content?.[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Large Fast Path' }],
    });
    expect(doc?.content?.[1]).toEqual({
      type: 'html_block',
      attrs: { value: '<!--vlaina-markdown-blank-line-->' },
    });
    expect(doc?.content?.[2]?.type).toBe('paragraph');
  });

  it('rejects large markdown that needs full markdown parsing', () => {
    const markdown = Array.from(
      { length: 1100 },
      (_, index) => `Paragraph ${index} with **strong** markup ${'plain text '.repeat(90)}`,
    ).join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
  });

  it('rejects large markdown with character references that need markdown decoding', () => {
    const markdown = [
      '# Large Entity Document',
      '',
      ...Array.from({ length: 1100 }, (_, index) => (
        index === 100
          ? `Paragraph ${index} with Fish &amp; Chips ${'plain text '.repeat(90)}`
          : `Paragraph ${index} ${'plain text '.repeat(90)}`
      )),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
  });

  it('rejects large markdown with GFM autolink literals', () => {
    const paragraph = 'plain text '.repeat(120);
    const cases = [
      `Paragraph with https://example.com/path ${paragraph}`,
      `Paragraph with www.example.com ${paragraph}`,
      `Paragraph with hello@example.com ${paragraph}`,
      `# Heading with https://example.com`,
    ];

    for (const line of cases) {
      const markdown = [
        '# Large Autolink Document',
        '',
        ...Array.from({ length: 1100 }, (_value, index) => (
          index === 100 ? line : `Paragraph ${index} ${paragraph}`
        )),
      ].join('\n\n');

      expect(markdown.length).toBeGreaterThan(1_000_000);
      expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
    }
  });

  it('rejects large markdown with structural list and rule syntax', () => {
    const paragraph = 'plain text '.repeat(120);
    const cases = [
      `- item ${paragraph}`,
      `1. item ${paragraph}`,
      `: definition ${paragraph}`,
      `---`,
      `----`,
      `****`,
      `_ _ _ _`,
      `===`,
    ];

    for (const structuralLine of cases) {
      const markdown = [
        '# Large Structural Document',
        '',
        ...Array.from({ length: 1100 }, (_value, index) => (
          index === 100 ? structuralLine : `Paragraph ${index} ${paragraph}`
        )),
      ].join('\n\n');

      expect(markdown.length).toBeGreaterThan(1_000_000);
      expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
    }
  });

  it('rejects large markdown with empty atx headings', () => {
    const paragraph = 'plain text '.repeat(120);
    const cases = [
      '#',
      '###',
      '### ',
      '# #',
      '## ##',
    ];

    for (const headingLine of cases) {
      const markdown = [
        '# Large Empty Heading Document',
        '',
        ...Array.from({ length: 1100 }, (_value, index) => (
          index === 100 ? headingLine : `Paragraph ${index} ${paragraph}`
        )),
      ].join('\n\n');

      expect(markdown.length).toBeGreaterThan(1_000_000);
      expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
    }
  });

  it('rejects adjacent plain text lines that form a CommonMark soft-wrapped paragraph', () => {
    const markdown = [
      '# Large Soft Wrapped Document',
      '',
      ...Array.from({ length: 1100 }, (_value, index) => (
        index === 100
          ? ['first soft wrapped line', `second soft wrapped line ${'plain text '.repeat(100)}`].join('\n')
          : `Paragraph ${index} ${'plain text '.repeat(100)}`
      )),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
  });

  it('normalizes closing atx heading markers on the fast path', () => {
    const markdown = [
      '# Large Fast Path #',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    const doc = createLargePlainMarkdownDocJSON(markdown);

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(doc?.content?.[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Large Fast Path' }],
    });
  });
});

describe('shouldUseLazyBlockVisibility', () => {
  it('enables lazy block visibility for large plain fast-path markdown', () => {
    const markdown = [
      '# Large Fast Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(shouldUseLazyBlockVisibility(markdown)).toBe(true);
  });

  it('keeps mixed syntax markdown on stable block layout for smoother scrolling', () => {
    const markdown = [
      '# Large Complex Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} with **strong** markup ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(shouldUseLazyBlockVisibility(markdown)).toBe(false);
  });
});
