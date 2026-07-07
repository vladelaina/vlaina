let autoSyncTrigger: ((sessionId?: string) => void) | null = null;
let autoSyncTriggerRegistrationId = 0;

export function setChatStorageAutoSyncTrigger(
  trigger: ((sessionId?: string) => void) | null,
): void {
  autoSyncTriggerRegistrationId += 1;
  autoSyncTrigger = trigger;
}

export function registerChatStorageAutoSyncTrigger(
  trigger: (sessionId?: string) => void,
): () => void {
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

export function notifyChatStorageAutoSync(sessionId: string): void {
  autoSyncTrigger?.(sessionId);
}
