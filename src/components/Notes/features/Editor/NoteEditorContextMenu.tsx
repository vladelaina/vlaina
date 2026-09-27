import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n';
import {
  applyRichFormatting,
  cutSelection,
  deleteRichSelection,
  focusEditor,
  getEditorViewForContextMenu,
  insertRichAction,
  setSelectionAtPoint,
  type ContextMenuInsertAction,
} from './noteEditorContextMenuActions';
import {
  copyRichSelection,
  pasteIntoEditor,
  type ContextMenuCopyFormat,
} from './noteEditorContextMenuClipboardActions';
import {
  applySourceBlockType,
  applySourceFormatting,
  copySourceSelection,
  cutSourceSelection,
  deleteSourceSelection,
  getSourceActiveMarks,
  getSourceBlockType,
  insertSourceAction,
  pasteSourceText,
} from './noteEditorContextMenuSourceActions';
import { getBlockSelectionPluginState } from './plugins/cursor/blockSelectionPluginState';
import { convertBlockType } from './plugins/floating-toolbar/blockCommands';
import { getActiveMarks, getCurrentBlockType } from './plugins/floating-toolbar/selectionHelpers';
import type { BlockType } from './plugins/floating-toolbar/types';
import { getCurrentEditorView } from './utils/editorViewRegistry';
import type { MessageKey } from '@/lib/i18n';
import {
  clampContextMenuPosition,
  IconButton,
  MenuDivider,
  MenuItem,
  Submenu,
  type ContextMenuPosition,
} from './noteEditorContextMenuPrimitives';
import { NoteEditorContextMenuInsert } from './NoteEditorContextMenuInsert';

type MenuMode = 'rich' | 'source';
type MenuSubmenu = 'copy' | 'paragraph' | 'insert' | null;

interface MenuSession {
  activeMarks: Set<string>;
  blockType: BlockType | null;
  mode: MenuMode;
  source: HTMLTextAreaElement | null;
  view: ReturnType<typeof getCurrentEditorView>;
  hasSelection: boolean;
}

interface SourceSelectionSnapshot {
  editor: HTMLTextAreaElement;
  value: string;
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none';
}

export function NoteEditorContextMenu({
  active = true,
  rootRef,
}: {
  active?: boolean;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const [session, setSession] = useState<MenuSession | null>(null);
  const [position, setPosition] = useState<ContextMenuPosition>({ left: 0, top: 0 });
  const [submenu, setSubmenu] = useState<MenuSubmenu>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sourceSelectionRef = useRef<SourceSelectionSnapshot | null>(null);

  const close = useCallback(() => {
    setSession(null);
    setSubmenu(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-note-context-menu-layer="true"]')) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.isComposing && event.key === 'Escape') close();
    };
    const handleScroll = (event: Event) => {
      if (
        event.target instanceof Element
        && event.target.closest('[data-note-context-menu-layer="true"]')
      ) return;
      close();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [close, session]);

  useLayoutEffect(() => {
    if (!session || !menuRef.current) return;
    const menu = menuRef.current;
    setPosition((current) => clampContextMenuPosition(current, menu.offsetWidth, menu.offsetHeight));
  }, [session, submenu]);

  useEffect(() => {
    if (!active) close();
  }, [active, close]);

  useEffect(() => {
    const handleContextMenuCapture = () => close();
    const handleMouseDownCapture = (event: MouseEvent) => {
      if (event.button !== 2 || !(event.target instanceof Element)) return;
      sourceSelectionRef.current = null;
      const source = event.target.closest('[data-note-source-editor="true"]');
      if (!(source instanceof HTMLTextAreaElement)) return;
      sourceSelectionRef.current = {
        editor: source,
        value: source.value,
        start: source.selectionStart,
        end: source.selectionEnd,
        direction: source.selectionDirection,
      };
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (!active || !(event.target instanceof Element)) return;
      if (event.defaultPrevented) return;
      const source = event.target.closest('[data-note-source-editor="true"]');
      const richTarget = event.target.closest('.ProseMirror');
      if (!source && !richTarget) return;
      if (event.target.closest('[data-no-editor-drag-box="true"]')) return;
      const currentView = richTarget ? getEditorViewForContextMenu() : null;
      const view = currentView && currentView.dom === richTarget ? currentView : null;
      if (richTarget && !view) return;

      event.preventDefault();
      if (view) setSelectionAtPoint(view, event.clientX, event.clientY);
      const sourceEditor = source instanceof HTMLTextAreaElement ? source : null;
      const sourceSnapshot = sourceSelectionRef.current;
      sourceSelectionRef.current = null;
      if (
        sourceEditor
        && sourceSnapshot?.editor === sourceEditor
        && sourceSnapshot.value === sourceEditor.value
      ) {
        sourceEditor.setSelectionRange(
          sourceSnapshot.start,
          sourceSnapshot.end,
          sourceSnapshot.direction,
        );
      }
      sourceEditor?.focus({ preventScroll: true });
      setSubmenu(null);
      setPosition({ left: event.clientX, top: event.clientY });
      setSession({
        activeMarks: view ? getActiveMarks(view) : getSourceActiveMarks(sourceEditor),
        blockType: view ? getCurrentBlockType(view) : getSourceBlockType(sourceEditor),
        mode: view ? 'rich' : 'source',
        source: sourceEditor,
        view,
        hasSelection: view
          ? getBlockSelectionPluginState(view.state).selectedBlocks.length > 0 || !view.state.selection.empty
          : Boolean(sourceEditor && sourceEditor.selectionStart !== sourceEditor.selectionEnd),
      });
    };

    const root = rootRef.current;
    if (!root) return;
    root.addEventListener('mousedown', handleMouseDownCapture, true);
    root.addEventListener('contextmenu', handleContextMenuCapture, true);
    root.addEventListener('contextmenu', handleContextMenu);
    return () => {
      root.removeEventListener('mousedown', handleMouseDownCapture, true);
      root.removeEventListener('contextmenu', handleContextMenuCapture, true);
      root.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [active, close, rootRef]);

  if (!session) return null;

  const run = (callback: () => unknown | Promise<unknown>) => {
    close();
    void callback();
  };

  const copy = (format: ContextMenuCopyFormat) => run(async () => {
    if (session.mode === 'rich' && session.view) await copyRichSelection(session.view, format);
    else if (session.source) await copySourceSelection(session.source, format);
  });

  const paste = (plainText: boolean) => run(async () => {
    if (session.mode === 'rich' && session.view) {
      focusEditor(session.view);
      await pasteIntoEditor(session.view, plainText);
    } else if (session.source) {
      await pasteSourceText(session.source);
    }
  });

  const format = (action: string) => run(() => {
    if (session.mode === 'rich' && session.view) applyRichFormatting(session.view, action);
    else if (session.source) applySourceFormatting(session.source, action);
  });

  const blockType = (type: string) => run(() => {
    if (session.mode === 'rich' && session.view) {
      const richType = type as BlockType;
      if (richType === 'paragraph' || richType.startsWith('heading')) {
        convertBlockType(session.view, richType);
      }
    } else if (session.source) applySourceBlockType(session.source, type);
  });

  const insert = (action: ContextMenuInsertAction) => run(() => {
    if (session.mode === 'rich' && session.view) return insertRichAction(session.view, action);
    else if (session.source) return insertSourceAction(session.source, action);
  });

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-note-context-menu-layer="true"
      className="editor-context-menu"
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="editor-context-menu-icon-row">
        <IconButton icon="common.cut" label={t('editor.contextMenu.cut')} shortcut="Ctrl+X" disabled={!session.hasSelection} onClick={() => run(async () => {
          if (session.mode === 'rich' && session.view) await cutSelection(session.view);
          else if (session.source) await cutSourceSelection(session.source);
        })} />
        <IconButton icon="common.copy" label={t('common.copy')} shortcut="Ctrl+C" disabled={!session.hasSelection} onClick={() => copy(session.mode === 'rich' ? 'rich' : 'markdown')} />
        <IconButton icon="common.paste" label={t('editor.contextMenu.paste')} shortcut="Ctrl+V" onClick={() => paste(false)} />
        <IconButton icon="common.delete" label={t('common.delete')} shortcut="Delete" disabled={!session.hasSelection} onClick={() => run(() => {
          if (session.mode === 'rich' && session.view) deleteRichSelection(session.view);
          else if (session.source) deleteSourceSelection(session.source);
        })} />
      </div>
      <MenuDivider />
      <div className="editor-context-menu-format-grid">
        <IconButton icon="editor.bold" label={t('shortcut.action.bold')} shortcut="Ctrl+B" active={session.activeMarks.has('strong')} onClick={() => format('bold')} />
        <IconButton icon="editor.italic" label={t('shortcut.action.italic')} shortcut="Ctrl+I" active={session.activeMarks.has('emphasis')} onClick={() => format('italic')} />
        <IconButton icon="editor.underline" label={t('shortcut.action.underline')} shortcut="Ctrl+U" active={session.activeMarks.has('underline')} onClick={() => format('underline')} />
        <IconButton icon="editor.strike" label={t('shortcut.action.strikethrough')} shortcut="Ctrl+Shift+5" active={session.activeMarks.has('strike_through')} onClick={() => format('strike')} />
        <IconButton icon="editor.code" label={t('shortcut.action.inlineCode')} shortcut="Ctrl+Shift+`" active={session.activeMarks.has('inlineCode')} onClick={() => format('code')} />
        <IconButton icon="editor.highlight" label={t('editor.highlight')} shortcut="Ctrl+H" active={session.activeMarks.has('highlight')} onClick={() => format('highlight')} />
        <IconButton icon="editor.link" label={t('shortcut.action.link')} shortcut="Ctrl+K" active={session.activeMarks.has('link')} disabled={!session.hasSelection} onClick={() => format('link')} />
        <IconButton icon="common.quote" label={t('editor.blockType.blockquote')} shortcut="Ctrl+Shift+Q" active={session.blockType === 'blockquote'} onClick={() => format('quote')} />
        <IconButton icon="editor.listOrdered" label={t('editor.blockType.orderedList')} shortcut="Ctrl+Shift+[" active={session.blockType === 'orderedList'} onClick={() => format('ordered-list')} />
        <IconButton icon="editor.list" label={t('editor.blockType.bulletList')} shortcut="Ctrl+Shift+]" active={session.blockType === 'bulletList'} onClick={() => format('bullet-list')} />
        <IconButton icon="editor.checkSquare" label={t('editor.blockType.taskList')} shortcut="Ctrl+Shift+X" active={session.blockType === 'taskList'} onClick={() => format('task-list')} />
      </div>
      <MenuDivider />
      <Submenu label={t('editor.contextMenu.copyAndPaste')} open={submenu === 'copy'} onOpen={() => setSubmenu('copy')} onClose={() => setSubmenu((current) => current === 'copy' ? null : current)}>
        <MenuItem label={t('editor.contextMenu.copyAsMarkdown')} shortcut="Ctrl+Shift+C" disabled={!session.hasSelection} onSelect={() => copy('markdown')} />
        <MenuItem label={t('editor.contextMenu.copyAsHtml')} disabled={!session.hasSelection} onSelect={() => copy('html')} />
        <MenuItem label={t('editor.contextMenu.copyAsRichText')} disabled={!session.hasSelection} onSelect={() => copy('rich')} />
        <MenuItem label={t('editor.contextMenu.copyAsPlainText')} disabled={!session.hasSelection} onSelect={() => copy('plain')} />
        <MenuDivider />
        <MenuItem label={t('editor.contextMenu.pasteAsPlainText')} shortcut="Ctrl+Shift+V" onSelect={() => paste(true)} />
      </Submenu>
      <Submenu label={t('editor.blockType.paragraph')} open={submenu === 'paragraph'} onOpen={() => setSubmenu('paragraph')} onClose={() => setSubmenu((current) => current === 'paragraph' ? null : current)}>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <MenuItem key={level} label={t(`editor.blockType.heading${level}` as MessageKey)} shortcut={`Ctrl+${level}`} checked={session.blockType === `heading${level}`} onSelect={() => blockType(`heading${level}`)} />
        ))}
        <MenuDivider />
        <MenuItem label={t('editor.blockType.paragraph')} shortcut="Ctrl+0" checked={session.blockType === 'paragraph'} onSelect={() => blockType('paragraph')} />
      </Submenu>
      <Submenu label={t('editor.contextMenu.insert')} open={submenu === 'insert'} onOpen={() => setSubmenu('insert')} onClose={() => setSubmenu((current) => current === 'insert' ? null : current)}>
        <NoteEditorContextMenuInsert insert={insert} t={t} />
      </Submenu>
    </div>,
    document.body,
  );
}
