import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Milkdown, MilkdownProvider } from '@milkdown/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { normalizeAlternativeMathBlockFences } from '@/lib/notes/markdown/markdownSerializationUtils';
import { useEditorSave } from './hooks/useEditorSave';
import { usePendingMarkdownAutosave } from './hooks/usePendingMarkdownAutosave';
import { BodyLineNumberGutter } from './components/BodyLineNumberGutter';
import { logE2EMilkdownTiming } from './milkdownE2ETiming';
import type { ActiveMilkdownEditor } from './MilkdownEditorInnerTypes';
import { useMilkdownAutoFocus } from './useMilkdownAutoFocus';
import { useMilkdownEditorActivation } from './useMilkdownEditorActivation';
import { useMilkdownEditorFactory } from './useMilkdownEditorFactory';
import { useMilkdownExternalContentSync } from './useMilkdownExternalContentSync';
import { useMilkdownThemeRuntime } from './useMilkdownThemeRuntime';
import { getMilkdownEditorClassName } from './milkdownEditorClassName';

export { createLargePlainMarkdownDocJSON, shouldUseLazyBlockVisibility } from './milkdownLargePlainMarkdown';
export {
  isEditorMarkdownEquivalentToNoteContent,
  isSameVisibleNoteContentIgnoringManagedFrontmatter,
  normalizeInitialEditorSelection,
  replaceEditorMarkdown,
} from './milkdownEditorMarkdownReplacement';

interface MilkdownEditorInnerProps { active?: boolean; showBodyLineNumbers?: boolean; preserveStartupEditorPosition?: boolean; onEditorViewReady?: () => void; }

export function MilkdownEditorRuntime({
  active = true,
  showBodyLineNumbers = false,
  preserveStartupEditorPosition = false,
  onEditorViewReady,
}: MilkdownEditorInnerProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner
        active={active}
        showBodyLineNumbers={showBodyLineNumbers}
        preserveStartupEditorPosition={preserveStartupEditorPosition}
        onEditorViewReady={onEditorViewReady}
      />
    </MilkdownProvider>
  );
}

export const MilkdownEditorInner = React.memo(function MilkdownEditorInner({
  active = true,
  showBodyLineNumbers = false,
  preserveStartupEditorPosition = false,
  onEditorViewReady,
}: MilkdownEditorInnerProps) {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const currentNoteDiskRevision = useNotesStore(s => s.currentNoteDiskRevision);
  const currentDraftName = useNotesStore(
    useCallback((state) => (
      currentNotePath ? state.draftNotes?.[currentNotePath]?.name : undefined
    ), [currentNotePath])
  );
  const currentNoteContentRef = useRef(useNotesStore.getState().currentNote?.content ?? '');
  const lastAppliedNoteRef = useRef({
    path: currentNotePath,
    diskRevision: currentNoteDiskRevision,
    content: currentNoteContentRef.current,
  });
  const isDraftNote = isDraftNotePath(currentNotePath);
  const onEditorViewReadyRef = useRef(onEditorViewReady);
  const activeRef = useRef(active);
  const readyReportedRef = useRef<{
    content: string;
    diskRevision: number;
    editor: ActiveMilkdownEditor;
    path: string | undefined;
  } | null>(null);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const hasLocalMarkdownCommitRef = useRef(false);
  const activatedEditorRef = useRef<ActiveMilkdownEditor | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const activationCleanupRef = useRef<(() => void) | null>(null);
  const lazyBlockVisibilityRef = useRef<{
    content: string;
    diskRevision: number;
    path: string | undefined;
    value: boolean;
  } | null>(null);
  const [activatedRevision, setActivatedRevision] = useState(0);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);
  const markLocalMarkdownCommitted = useCallback((content: string) => {
    hasLocalMarkdownCommitRef.current = true;
    lastAppliedNoteRef.current = {
      path: currentNotePath,
      diskRevision: currentNoteDiskRevision,
      content,
    };
  }, [currentNoteDiskRevision, currentNotePath]);
  const {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
    shouldSerializeEditorMarkdown,
  } = usePendingMarkdownAutosave({
    currentNotePath,
    currentNoteDiskRevision,
    currentNoteContent,
    updateContent,
    debouncedSave,
    onLocalMarkdownCommitted: markLocalMarkdownCommitted,
  });

  const initialContent = useMemo(() => {
    const startedAt = performance.now();
    const normalized = normalizeAlternativeMathBlockFences(currentNoteContentRef.current);
    logE2EMilkdownTiming('initial-content', {
      notePath: currentNotePath,
      inputLength: currentNoteContentRef.current.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return normalized;
  }, []);
  const {
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
    markdownThemeRuntimeColorScheme,
    markdownThemeViewport,
    typewriterMode,
    typoraRuntimePlatformClasses,
  } = useMilkdownThemeRuntime({ activatedRevision, editorShellRef });

  useEffect(() => {
    onEditorViewReadyRef.current = onEditorViewReady;
  }, [onEditorViewReady]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    currentNoteContentRef.current = currentNoteContent;
  }, [currentNoteContent]);

  useEffect(() => {
    const handleBlur = () => {
      flushCurrentPendingEditorMarkdown();
      flushSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [flushSave]);

  const { activateEditor, cleanupActivatedEditor, reportEditorReady } = useMilkdownEditorActivation({
    activeRef,
    activatedEditorRef,
    activationCleanupRef,
    createUserInputMarker,
    currentNoteContentRef,
    currentNoteDiskRevision,
    currentNotePath,
    onEditorViewReadyRef,
    preserveStartupEditorPosition,
    readyReportedRef,
    setActivatedRevision,
  });

  const { get } = useMilkdownEditorFactory({
    activateEditor,
    activatedEditorRef,
    cleanupActivatedEditor,
    configureMarkdownListener,
    currentNotePath,
    initialContent,
    reportEditorReady,
    shouldSerializeEditorMarkdown,
  });

  useEffect(() => {
    hasAutoFocused.current = false;
    hasScheduledAutoFocus.current = false;
    hasLocalMarkdownCommitRef.current = false;
  }, [currentNotePath]);

  useEffect(() => {
    setEditorGetter(get);
  }, [get, setEditorGetter]);

  useMilkdownExternalContentSync({
    activatedRevision,
    currentNoteContent,
    currentNoteDiskRevision,
    currentNotePath,
    get,
    hasLocalMarkdownCommitRef,
    lastAppliedNoteRef,
    reportEditorReady,
  });

  useEffect(() => {
    return () => {
      cleanupActivatedEditor();
    };
  }, [cleanupActivatedEditor, currentNotePath]);

  useEffect(() => {
    if (!active) {
      cleanupActivatedEditor();
      return;
    }

    try {
      const editor = get?.() as ActiveMilkdownEditor | undefined;
      if (!editor) {
        cleanupActivatedEditor();
        return;
      }
      if (activatedEditorRef.current !== editor) {
        activateEditor(editor);
      }
      if (
        editor.status === 'Created' &&
        lastAppliedNoteRef.current.path === currentNotePath &&
        lastAppliedNoteRef.current.diskRevision === currentNoteDiskRevision &&
        lastAppliedNoteRef.current.content === currentNoteContent
      ) {
        reportEditorReady(editor);
      }
    } catch {
      cleanupActivatedEditor();
      return;
    }
  }, [
    activateEditor,
    active,
    cleanupActivatedEditor,
    currentNoteContent,
    currentNoteDiskRevision,
    currentNotePath,
    get,
    reportEditorReady,
  ]);

  const { useLazyBlockVisibility } = useMilkdownAutoFocus({
    active,
    activatedRevision,
    currentDraftName,
    currentNoteContent,
    currentNoteDiskRevision,
    currentNotePath,
    get,
    hasAutoFocused,
    hasScheduledAutoFocus,
    isDraftNote,
    isNewlyCreated,
    lazyBlockVisibilityRef,
    preserveStartupEditorPosition,
  });

  return (
    <div
      ref={editorShellRef}
      className={getMilkdownEditorClassName({
        importedMarkdownThemeId,
        importedMarkdownThemePlatform,
        markdownThemeColorScheme: markdownThemeRuntimeColorScheme.colorScheme,
        markdownThemeViewport,
        showBodyLineNumbers,
        typewriterMode,
        typoraRuntimePlatformClasses,
      })}
      data-note-content-root="true"
      data-note-lazy-block-visibility={useLazyBlockVisibility ? 'true' : undefined}
      data-markdown-theme-root="true"
      data-markdown-theme-platform={importedMarkdownThemeId ? importedMarkdownThemePlatform ?? 'external' : 'vlaina'}
      data-markdown-compat={importedMarkdownThemeId ? 'external' : 'native'}
      data-markdown-compat-layer={importedMarkdownThemeId ? 'external' : 'native'}
      data-markdown-imported-theme={importedMarkdownThemeId ?? undefined}
      data-markdown-theme-color-scheme={markdownThemeRuntimeColorScheme.colorScheme}
      data-markdown-theme-color-scheme-mode={markdownThemeRuntimeColorScheme.mode}
      data-theme={markdownThemeRuntimeColorScheme.colorScheme}
    >
      {showBodyLineNumbers && (
        <BodyLineNumberGutter
          markdown={currentNoteContent}
          shellRef={editorShellRef}
          revision={activatedRevision}
        />
      )}
      <Milkdown />
    </div>
  );
});
