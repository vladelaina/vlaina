import { isManagedProviderId } from '@/lib/ai/managedService';
import { markManagedQuotaExhausted, shouldBlockManagedRequestAfterBudgetRefresh } from './requestLifecycle';
import { requestManagedAccountSignIn } from './errorHandling';

interface ManagedRequestGateOptions {
  providerId: string;
  isAccountConnected: boolean;
  sessionId: string | null;
  setError: (error: string | null) => void;
}

export async function shouldStopForManagedAccountState({
  providerId,
  isAccountConnected,
  sessionId,
  setError,
}: ManagedRequestGateOptions): Promise<boolean> {
  if (isManagedProviderId(providerId) && !isAccountConnected) {
    setError(null);
    requestManagedAccountSignIn(sessionId);
    return true;
  }

  if (await shouldBlockManagedRequestAfterBudgetRefresh(providerId)) {
    markManagedQuotaExhausted();
    setError(null);
    return true;
  }

  return false;
}
