import { createPersistenceQueue } from './persistenceEngine';
import type { UnifiedData } from './unifiedStorageTypes';
import { performSplitSave } from './unifiedStorageSave';
import { mergeUnifiedSavePatches } from './unifiedStorageMainFiles';
import { showStorageToast } from './unifiedStorageNotifications';
import type { UnifiedSavePatch, UnifiedSaveRequest } from './unifiedStorageSaveTypes';
import {
  getUnifiedSaveRequestDiagnosticDetails,
  getUnifiedStorageErrorDiagnosticDetails,
  logUnifiedStorageDiagnostic,
} from './unifiedStorageDiagnostics';

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
let consecutiveUnifiedSaveFailures = 0;

const unifiedSaveQueue = createPersistenceQueue<UnifiedSaveRequest>({
  debounceMs: 120,
  write: async (request) => {
    logUnifiedStorageDiagnostic('write-started', {
      attempt: consecutiveUnifiedSaveFailures + 1,
      ...getUnifiedSaveRequestDiagnosticDetails(request),
    });
    await performSplitSave(request);
    logUnifiedStorageDiagnostic('write-succeeded', {
      recoveredAfterFailures: consecutiveUnifiedSaveFailures,
      ...getUnifiedSaveRequestDiagnosticDetails(request),
    });
    consecutiveUnifiedSaveFailures = 0;
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = false;
    hasShownPersistenceFailureToast = false;
    triggerAutoSyncIfEligible();
  },
  onError: (error) => {
    consecutiveUnifiedSaveFailures += 1;
    logUnifiedStorageDiagnostic('write-failed', {
      consecutiveFailures: consecutiveUnifiedSaveFailures,
      willRetry: true,
      ...getUnifiedStorageErrorDiagnosticDetails(error),
    });
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

  const request = {
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  };
  logUnifiedStorageDiagnostic('save-scheduled', getUnifiedSaveRequestDiagnosticDetails(request));
  unifiedSaveQueue.schedule(request);
}

export async function flushPendingSave(): Promise<void> {
  logUnifiedStorageDiagnostic('flush-requested', { hasPending: unifiedSaveQueue.hasPending() });
  await unifiedSaveQueue.flush();
}

export function cancelPendingSave(): void {
  pendingUnifiedSavePatch = undefined;
  pendingUnifiedSaveRequiresFullWrite = false;
  logUnifiedStorageDiagnostic('pending-save-cancelled', { hadPending: unifiedSaveQueue.hasPending() });
  unifiedSaveQueue.cancel();
}

export async function saveUnifiedDataImmediate(data: UnifiedData, patch?: UnifiedSavePatch): Promise<void> {
  if (patch) {
    pendingUnifiedSavePatch = mergeUnifiedSavePatches(pendingUnifiedSavePatch, patch);
  } else {
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = true;
  }

  const request = {
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  };
  logUnifiedStorageDiagnostic('immediate-save-requested', getUnifiedSaveRequestDiagnosticDetails(request));
  await unifiedSaveQueue.saveNow(request);
}

function triggerAutoSyncIfEligible(): void {
  autoSyncTrigger?.();
}
