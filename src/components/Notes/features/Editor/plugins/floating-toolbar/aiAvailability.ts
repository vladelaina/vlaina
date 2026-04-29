import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';

export function canShowSelectionAiTools(): boolean {
  if (useAccountSessionStore.getState().isConnected) {
    return true;
  }

  const providers = useUnifiedStore.getState().data.ai?.providers ?? [];
  return providers.some(
    (provider) => provider.id !== MANAGED_PROVIDER_ID && provider.enabled !== false
  );
}
