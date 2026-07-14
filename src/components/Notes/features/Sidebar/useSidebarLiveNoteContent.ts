import { useEffect, useState } from 'react';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { useNotesStore } from '@/stores/useNotesStore';

export function useSidebarLiveNoteContent({
  active,
  currentNotePath,
}: {
  active: boolean;
  currentNotePath?: string | null;
}) {
  const [liveNoteContent, setLiveNoteContent] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const setNextLiveNoteContent = (next: { path: string; content: string } | null) => {
      setLiveNoteContent((current) => (
        current?.path === next?.path && current?.content === next?.content
          ? current
          : next
      ));
    };

    const currentNote = useNotesStore.getState().currentNote;
    setNextLiveNoteContent(currentNotePath && currentNote?.path === currentNotePath
      ? { path: currentNotePath, content: stripManagedFrontmatter(currentNote.content) }
      : null);

    const handleLiveMarkdownPreview = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: unknown; content?: unknown }>).detail;
      if (
        !detail ||
        typeof detail.path !== 'string' ||
        typeof detail.content !== 'string' ||
        detail.path !== currentNotePath
      ) {
        return;
      }

      setNextLiveNoteContent({
        path: detail.path,
        content: stripManagedFrontmatter(detail.content),
      });
    };

    window.addEventListener('editor:note-markdown-preview', handleLiveMarkdownPreview);
    return () => {
      window.removeEventListener('editor:note-markdown-preview', handleLiveMarkdownPreview);
    };
  }, [active, currentNotePath]);

  return liveNoteContent;
}
