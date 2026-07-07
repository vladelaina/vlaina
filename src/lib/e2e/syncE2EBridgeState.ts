import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import type { NotesState } from '@/stores/notes/types';

const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';
let lastE2ERootFolderReference: NotesState['rootFolder'] | undefined;
let e2eRootFolderReferenceVersion = 0;

export function getE2ERootFolderReferenceVersion(rootFolder: NotesState['rootFolder']): number {
  if (rootFolder !== lastE2ERootFolderReference) {
    lastE2ERootFolderReference = rootFolder;
    e2eRootFolderReferenceVersion += 1;
  }

  return e2eRootFolderReferenceVersion;
}

export function isE2EBridgeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('e2e') === '1') {
    try {
      window.localStorage.setItem(E2E_LOCAL_STORAGE_KEY, '1');
    } catch {
    }
    return true;
  }

  try {
    return window.localStorage.getItem(E2E_LOCAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export async function waitForUnifiedLoaded(): Promise<void> {
  if (useUnifiedStore.getState().loaded) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for unified store to load'));
    }, 10000);

    const unsubscribe = useUnifiedStore.subscribe((state) => {
      if (!state.loaded) {
        return;
      }

      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    });
  });
}
