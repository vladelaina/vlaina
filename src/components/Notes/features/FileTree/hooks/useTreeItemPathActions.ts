import { useCallback } from 'react';
import { useToastStore } from '@/stores/useToastStore';
import { copyTreeItemPath, openTreeItemLocation } from '../pathActions';

interface UseTreeItemPathActionsOptions {
  notesPath: string;
  itemPath: string;
  copyErrorMessage?: string;
  openLocationErrorMessage?: string;
}

export function useTreeItemPathActions({
  notesPath,
  itemPath,
  copyErrorMessage = 'Failed to copy path.',
  openLocationErrorMessage = 'Failed to open file location.',
}: UseTreeItemPathActionsOptions) {
  const addToast = useToastStore((state) => state.addToast);

  const handleCopyPath = useCallback(async () => {
    try {
      await copyTreeItemPath(notesPath, itemPath);
    } catch (error) {
      addToast(error instanceof Error ? error.message : copyErrorMessage, 'error');
    }
  }, [addToast, copyErrorMessage, itemPath, notesPath]);

  const handleOpenLocation = useCallback(async () => {
    try {
      await openTreeItemLocation(notesPath, itemPath);
    } catch (error) {
      addToast(error instanceof Error ? error.message : openLocationErrorMessage, 'error');
    }
  }, [addToast, itemPath, notesPath, openLocationErrorMessage]);

  return {
    handleCopyPath,
    handleOpenLocation,
  };
}
