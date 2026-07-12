import { lazy, useEffect } from 'react';

export function once<T>(factory: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) {
      const nextPromise = factory().catch((error) => {
        if (promise === nextPromise) {
          promise = null;
        }
        throw error;
      });
      promise = nextPromise;
    }
    return promise;
  };
}

export const preloadSettingsModule = once(() => import('@/components/Settings'));
export const preloadNotesViewModule = once(() => import('@/components/Notes/NotesView'));
export const preloadChatViewModule = once(() => import('@/components/Chat/ChatView'));
export const preloadWhiteboardViewModule = once(() => import('@/components/Whiteboard'));
export const preloadNotesSidebarModule = once(() => import('@/components/Notes/features/Sidebar/NotesSidebarWrapper'));
export const preloadChatSidebarModule = once(() => import('@/components/Chat/features/Sidebar/ChatSidebar'));
export const preloadTemporaryChatToggleModule = once(() => import('@/components/Chat/features/Temporary/TitleBarTemporaryChatToggle'));
export const preloadModelSelectorModule = once(() => import('@/components/Chat/features/Input/ModelSelector'));
export const preloadNotesTabRowModule = once(() => import('@/components/Notes/features/Tabs/NotesTabRow'));
export const preloadAIStoreModule = once(() => import('@/stores/useAIStore'));

export const SettingsModal = lazy(async () => {
  const mod = await preloadSettingsModule();
  return { default: mod.SettingsModal };
});

export const NotesView = lazy(async () => {
  const mod = await preloadNotesViewModule();
  return { default: mod.NotesView };
});

export const ChatView = lazy(async () => {
  const mod = await preloadChatViewModule();
  return { default: mod.ChatView };
});

export const WhiteboardView = lazy(async () => {
  const mod = await preloadWhiteboardViewModule();
  return { default: mod.WhiteboardView };
});

export const WhiteboardSidebar = lazy(async () => {
  const mod = await preloadWhiteboardViewModule();
  return { default: mod.WhiteboardSidebar };
});

export const LabView = import.meta.env.DEV
  ? lazy(async () => {
    const mod = await import('@/components/Lab/LabView');
    return { default: mod.LabView };
  })
  : null;

export const DevMainOverlay = import.meta.env.DEV
  ? lazy(async () => {
    const mod = await import('@/components/Dev/DevMainOverlay');
    return { default: mod.DevMainOverlay };
  })
  : null;

export const NotesSidebarWrapper = lazy(async () => {
  const mod = await preloadNotesSidebarModule();
  return { default: mod.NotesSidebarWrapper };
});

export const ChatSidebar = lazy(async () => {
  const mod = await preloadChatSidebarModule();
  return { default: mod.ChatSidebar };
});

export const TemporaryChatToggle = lazy(async () => {
  const mod = await preloadTemporaryChatToggleModule();
  return { default: mod.TitleBarTemporaryChatToggle };
});

export const ModelSelector = lazy(async () => {
  const mod = await preloadModelSelectorModule();
  return { default: mod.ModelSelector };
});

export const NotesTabRow = lazy(async () => {
  const mod = await preloadNotesTabRowModule();
  return { default: mod.NotesTabRow };
});

export function StartupViewFallback({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      onReady();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [onReady]);

  return (
    <div className="h-full bg-transparent" />
  );
}
