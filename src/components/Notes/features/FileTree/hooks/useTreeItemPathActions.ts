import { useCallback } from 'react';
import { useToastStore } from '@/stores/useToastStore';
import { copyTreeItemPath, openTreeItemInNewWindow, openTreeItemLocation } from '../pathActions';

interface UseTreeItemPathActionsOptions {
  notesPath: string;
  itemPath: string;
  copyErrorMessage?: string;
  openLocationErrorMessage?: string;
  openInNewWindowErrorMessage?: string;
}

function isUnavailableNotesPathError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Notes path is not available';
}

export function useTreeItemPathActions({
  notesPath,
  itemPath,
  copyErrorMessage = 'Failed to copy path.',
  openLocationErrorMessage = 'Failed to open file location.',
  openInNewWindowErrorMessage = 'Failed to open in new window.',
}: UseTreeItemPathActionsOptions) {
  const addToast = useToastStore((state) => state.addToast);

  const handleCopyPath = useCallback(async () => {
    try {
      await copyTreeItemPath(notesPath, itemPath);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(error instanceof Error ? error.message : copyErrorMessage, 'error');
    }
  }, [addToast, copyErrorMessage, itemPath, notesPath]);

  const handleOpenLocation = useCallback(async (itemKind: 'file' | 'folder' = 'file') => {
    try {
      await openTreeItemLocation(notesPath, itemPath, itemKind);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(error instanceof Error ? error.message : openLocationErrorMessage, 'error');
    }
  }, [addToast, itemPath, notesPath, openLocationErrorMessage]);

  const handleOpenInNewWindow = useCallback(async (itemKind: 'file' | 'folder') => {
    try {
      await openTreeItemInNewWindow(notesPath, itemPath, itemKind);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(error instanceof Error ? error.message : openInNewWindowErrorMessage, 'error');
    }
  }, [addToast, itemPath, notesPath, openInNewWindowErrorMessage]);

  return {
    handleCopyPath,
    handleOpenInNewWindow,
    handleOpenLocation,
  };
}
