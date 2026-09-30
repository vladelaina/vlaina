import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRichFormatting,
  insertRichAction,
  type ContextMenuInsertAction,
} from './noteEditorContextMenuActions';

const mocks = vi.hoisted(() => ({
  applySlashCommand: vi.fn(),
  toggleMark: vi.fn(),
  currentAction: null as null | ((callback: (ctx: object) => unknown) => unknown),
  currentView: null as object | null,
}));

vi.mock('./plugins/slash/slashCommands', () => ({
  applySlashCommand: mocks.applySlashCommand,
}));
vi.mock('./utils/editorViewRegistry', () => ({
  getCurrentEditorAction: () => mocks.currentAction,
  getCurrentEditorView: () => mocks.currentView,
}));
vi.mock('./plugins/cursor/blockSelectionPluginState', () => ({
  clearBlockSelection: vi.fn(),
  getBlockSelectionPluginState: () => ({ selectedBlocks: [] }),
}));
vi.mock('./plugins/cursor/blockSelectionCommands', () => ({ deleteSelectedBlocks: vi.fn() }));
vi.mock('./plugins/floating-toolbar/blockCommands', () => ({ convertBlockType: vi.fn() }));
vi.mock('./plugins/floating-toolbar/linkTooltipActions', () => ({
  openLinkTooltipFromSelection: vi.fn(),
}));
vi.mock('./plugins/floating-toolbar/markCommands', () => ({ toggleMark: mocks.toggleMark }));
vi.mock('./plugins/shared/userInputEvents', () => ({ markEditorUserInput: vi.fn() }));
vi.mock('./noteEditorContextMenuClipboardActions', () => ({
  copyRichSelection: vi.fn(),
  pasteMarkdownTextIntoEditor: vi.fn(),
}));

describe('rich context menu insert actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentView = {};
    mocks.currentAction = (callback) => callback({});
  });

  it.each([
    ['image', 'image'],
    ['callout', 'callout'],
    ['emoji', 'emoji'],
    ['footnote', 'footnote'],
    ['footnote-definition', 'footnote-definition'],
    ['divider', 'divider'],
    ['table', 'table'],
    ['code', 'code-block'],
    ['formula', 'equation'],
    ['inline-math', 'inline-math'],
    ['toc', 'toc'],
    ['mermaid', 'mermaid'],
    ['html-block', 'html-block'],
    ['abbreviation', 'abbreviation'],
    ['video', 'video'],
    ['frontmatter', 'frontmatter'],
  ] as const)('runs the existing %s editor command', (action, commandId) => {
    const view = mocks.currentView as never;

    expect(insertRichAction(view, action satisfies ContextMenuInsertAction)).toBe(true);
    expect(mocks.applySlashCommand).toHaveBeenLastCalledWith({}, commandId);
  });

  it('does not run an insert command against a stale editor', () => {
    expect(insertRichAction({} as never, 'callout')).toBe(false);
    expect(mocks.applySlashCommand).not.toHaveBeenCalled();
  });

  it.each([
    ['underline', 'underline'],
    ['strike', 'strike_through'],
    ['highlight', 'highlight'],
  ] as const)('applies the %s mark from the context menu', (action, markName) => {
    const view = mocks.currentView as never;

    expect(applyRichFormatting(view, action)).toBe(true);
    expect(mocks.toggleMark).toHaveBeenCalledWith(view, markName);
  });
});
