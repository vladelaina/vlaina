import { useCallback } from 'react';
import { useToastStore } from '@/stores/useToastStore';
import { translate } from '@/lib/i18n';
import { normalizeUserFacingErrorMessage } from '@/lib/i18n/userFacingErrors';
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

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message.trim();
  }
  return typeof error === 'string' ? error.trim() : '';
}

function getPathActionErrorMessage(error: unknown, fallbackMessage: string): string {
  const message = getRawErrorMessage(error);
  if (/^path must stay inside the opened folder\.?$/i.test(message)) {
    return message;
  }
  return normalizeUserFacingErrorMessage(error) || fallbackMessage;
}

export function useTreeItemPathActions({
  notesPath,
  itemPath,
  copyErrorMessage = translate('notes.copyPathFailed'),
  openLocationErrorMessage = translate('notes.openFileLocationFailed'),
  openInNewWindowErrorMessage = translate('notes.openInNewWindowFailed'),
}: UseTreeItemPathActionsOptions) {
  const addToast = useToastStore((state) => state.addToast);

  const handleCopyPath = useCallback(async () => {
    try {
      await copyTreeItemPath(notesPath, itemPath);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(getPathActionErrorMessage(error, copyErrorMessage), 'error');
    }
  }, [addToast, copyErrorMessage, itemPath, notesPath]);

  const handleOpenLocation = useCallback(async (itemKind: 'file' | 'folder' = 'file') => {
    try {
      await openTreeItemLocation(notesPath, itemPath, itemKind);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(getPathActionErrorMessage(error, openLocationErrorMessage), 'error');
    }
  }, [addToast, itemPath, notesPath, openLocationErrorMessage]);

  const handleOpenInNewWindow = useCallback(async (itemKind: 'file' | 'folder') => {
    try {
      await openTreeItemInNewWindow(notesPath, itemPath, itemKind);
    } catch (error) {
      if (isUnavailableNotesPathError(error)) {
        return;
      }
      addToast(getPathActionErrorMessage(error, openInNewWindowErrorMessage), 'error');
    }
  }, [addToast, itemPath, notesPath, openInNewWindowErrorMessage]);

  return {
    handleCopyPath,
    handleOpenInNewWindow,
    handleOpenLocation,
  };
}
