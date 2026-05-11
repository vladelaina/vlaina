import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { tableBlock } from '@milkdown/kit/component/table-block';
import type { Parser } from '@milkdown/kit/transformer';
import { Milkdown, useEditor } from '@milkdown/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { notesRemarkStringifyOptions } from './config/stringifyOptions';
import { useEditorSave } from './hooks/useEditorSave';
import { usePendingMarkdownAutosave } from './hooks/usePendingMarkdownAutosave';
import {
  clearCurrentMarkdownRuntime,
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  clearCurrentEditorBlockPositionSnapshot,
  createCurrentEditorBlockPositionController,
} from './utils/editorBlockPositionCache';
import { normalizeLeadingFrontmatterMarkdown } from './plugins/frontmatter/frontmatterMarkdown';

export const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isDraftNote = isDraftNotePath(currentNotePath);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);
  const {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
  } = usePendingMarkdownAutosave({
    currentNotePath,
    currentNoteContent,
    updateContent,
    debouncedSave,
  });

  const initialContent = useMemo(() => {
    return normalizeSerializedMarkdownDocument(currentNoteContent);
  }, [currentNoteContent]);

  useEffect(() => {
    const handleBlur = () => {
      flushSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [flushSave]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        const defaultValue = preserveMarkdownBlankLinesForEditor(
          normalizeLeadingFrontmatterMarkdown(initialContent)
        );

        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const handleMarkdownUpdated = configureMarkdownListener(ctx, initialContent);
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => handleMarkdownUpdated(markdown));
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(configureTheme)
      .use(tableBlock)
      .use(customPlugins),
    [configureMarkdownListener, currentNotePath]
  );

  useEffect(() => {
    hasAutoFocused.current = false;
    hasScheduledAutoFocus.current = false;
  }, [currentNotePath]);

  useEffect(() => {
    setEditorGetter(get);
  }, [get, setEditorGetter]);

  useEffect(() => {
    try {
      const editor = get?.();
      if (!editor) {
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
        return;
      }
      const view = editor.ctx.get(editorViewCtx);
      let parser: Parser | null = null;
      let liveSerializer: ((doc: unknown) => string) | null = null;
      try {
        parser = editor.ctx.get(parserCtx);
      } catch {
        parser = null;
      }
      try {
        const serializer = editor.ctx.get(serializerCtx);
        liveSerializer = serializer;
      } catch {
        liveSerializer = null;
      }
      setCurrentEditorView(view as EditorView);
      const markUserInput = createUserInputMarker(view as EditorView, liveSerializer);
      view.dom.addEventListener('beforeinput', markUserInput);
      view.dom.addEventListener('keydown', markUserInput);
      view.dom.addEventListener('vlaina:image-user-input', markUserInput);
      view.dom.addEventListener('paste', markUserInput);
      view.dom.addEventListener('cut', markUserInput);
      view.dom.addEventListener('drop', markUserInput);
      const blockPositionController = createCurrentEditorBlockPositionController(view as EditorView);
      setCurrentMarkdownRuntime({ parser, serializer: liveSerializer });
      return () => {
        view.dom.removeEventListener('beforeinput', markUserInput);
        view.dom.removeEventListener('keydown', markUserInput);
        view.dom.removeEventListener('vlaina:image-user-input', markUserInput);
        view.dom.removeEventListener('paste', markUserInput);
        view.dom.removeEventListener('cut', markUserInput);
        view.dom.removeEventListener('drop', markUserInput);
        blockPositionController.destroy();
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentEditorBlockPositionSnapshot();
      clearCurrentMarkdownRuntime();
      return;
    }
  }, [createUserInputMarker, get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  const shouldFocusEmptyDraftBody = isDraftNote && !isNewlyCreated && isEmptyContent;

  const focusEditorBody = useCallback(() => {
    try {
      const editor = get?.();
      if (!editor) {
        return false;
      }

      const view = editor.ctx.get(editorViewCtx);
      if (!view) {
        return false;
      }

      view.focus();
      return true;
    } catch {
      return false;
    }
  }, [get]);

  useEffect(() => {
    if (!get || hasAutoFocused.current || hasScheduledAutoFocus.current) return;
    const blockedReason = isNewlyCreated
      ? 'new-note-title-autofocus'
      : !isEmptyContent
        ? 'non-empty-content'
        : null;
    if (blockedReason) {
      return;
    }

    hasScheduledAutoFocus.current = true;

    const timer = setTimeout(() => {
      const focused = focusEditorBody();
      hasScheduledAutoFocus.current = false;
      if (focused) {
        hasAutoFocused.current = true;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      hasScheduledAutoFocus.current = false;
    };
  }, [currentNotePath, focusEditorBody, get, isDraftNote, isNewlyCreated, isEmptyContent]);

  useEffect(() => {
    if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
    const frame = requestAnimationFrame(() => {
      if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
      const focused = focusEditorBody();
      if (focused) {
        hasAutoFocused.current = true;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [currentNotePath, focusEditorBody, shouldFocusEmptyDraftBody]);

  return (
    <div
      className={cn("milkdown-editor", EDITOR_LAYOUT_CLASS)}
      data-note-content-root="true"
    >
      <Milkdown />
    </div>
  );
});
