import { useCallback } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock';
import { hydrateSessionMessagesFromDisk } from '@/stores/ai/sessionConsistency';

export function useSwitchMessageVersion() {
  return useCallback(
    async (sessionId: string, messageId: string, versionIndex: number) => {
      if (!sessionId) {
        return;
      }

      await runWithSessionMutationLock(sessionId, async () => {
        await hydrateSessionMessagesFromDisk(sessionId);
        aiActions.switchMessageVersion(sessionId, messageId, versionIndex);
      });
    },
    [],
  );
}
