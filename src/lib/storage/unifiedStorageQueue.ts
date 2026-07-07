import { createPersistenceQueue } from './persistenceEngine';
import type { UnifiedData } from './unifiedStorageTypes';
import { performSplitSave } from './unifiedStorageSave';
import { mergeUnifiedSavePatches } from './unifiedStorageMainFiles';
import { showStorageToast } from './unifiedStorageNotifications';
import type { UnifiedSavePatch, UnifiedSaveRequest } from './unifiedStorageSaveTypes';

let autoSyncTrigger: (() => void) | null = null;
let autoSyncTriggerRegistrationId = 0;
let hasShownPersistenceFailureToast = false;
export function setUnifiedStorageAutoSyncTrigger(trigger: (() => void) | null): void {
  autoSyncTriggerRegistrationId += 1;
  autoSyncTrigger = trigger;
}

export function registerUnifiedStorageAutoSyncTrigger(trigger: () => void): () => void {
  const registrationId = autoSyncTriggerRegistrationId + 1;
  autoSyncTriggerRegistrationId = registrationId;
  autoSyncTrigger = trigger;

  return () => {
    if (autoSyncTriggerRegistrationId !== registrationId) {
      return;
    }
    autoSyncTriggerRegistrationId += 1;
    autoSyncTrigger = null;
  };
}

let pendingUnifiedSavePatch: UnifiedSavePatch | undefined;
let pendingUnifiedSaveRequiresFullWrite = false;

const unifiedSaveQueue = createPersistenceQueue<UnifiedSaveRequest>({
  debounceMs: 120,
  write: async (request) => {
    await performSplitSave(request);
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = false;
    hasShownPersistenceFailureToast = false;
    triggerAutoSyncIfEligible();
  },
  onError: (_error) => {
    if (!hasShownPersistenceFailureToast) {
      hasShownPersistenceFailureToast = true;
      showStorageToast('storage.saveFailed', 'error', 5000);
    }
  },
});

function shouldPersistAIForPatch(patch: UnifiedSavePatch | undefined): boolean {
  return !!patch?.ai?.sessions || !!patch?.ai?.providers;
}

function shouldPersistProvidersForPatch(patch: UnifiedSavePatch | undefined): boolean {
  return !!patch?.ai?.providers;
}

export async function saveUnifiedData(data: UnifiedData, patch?: UnifiedSavePatch): Promise<void> {
  if (patch) {
    pendingUnifiedSavePatch = mergeUnifiedSavePatches(pendingUnifiedSavePatch, patch);
  } else {
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = true;
  }

  unifiedSaveQueue.schedule({
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  });
}

export async function flushPendingSave(): Promise<void> {
  await unifiedSaveQueue.flush();
}

export function cancelPendingSave(): void {
  pendingUnifiedSavePatch = undefined;
  pendingUnifiedSaveRequiresFullWrite = false;
  unifiedSaveQueue.cancel();
}

export async function saveUnifiedDataImmediate(data: UnifiedData, patch?: UnifiedSavePatch): Promise<void> {
  if (patch) {
    pendingUnifiedSavePatch = mergeUnifiedSavePatches(pendingUnifiedSavePatch, patch);
  } else {
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = true;
  }

  await unifiedSaveQueue.saveNow({
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  });
}

function triggerAutoSyncIfEligible(): void {
  autoSyncTrigger?.();
}
