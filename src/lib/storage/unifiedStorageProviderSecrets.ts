import type { Provider } from '@/lib/ai/types';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { isSafeProviderId } from './unifiedStorageAI';
import { showStorageToast, getAIProviderSecretCommands } from './unifiedStorageNotifications';
import {
  MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
} from './unifiedStorageSaveTypes';
import { mapWithConcurrencyLimit } from './unifiedStorageCommon';

let hasShownSecretLoadFailureToast = false;

export async function hydrateProvidersWithSecrets(
  providers: Provider[]
): Promise<Provider[]> {
  if (!hasElectronDesktopBridge() || providers.length === 0) {
    return providers;
  }

  let secretMap: Record<string, string> = {};
  try {
    const aiProviderSecretCommands = await getAIProviderSecretCommands();
    secretMap = await aiProviderSecretCommands.getProviderSecrets(providers.map((provider) => provider.id));
    hasShownSecretLoadFailureToast = false;
  } catch (error) {
    if (!hasShownSecretLoadFailureToast) {
      hasShownSecretLoadFailureToast = true;
      showStorageToast('storage.keychainUnavailable', 'error', 6000);
    }
  }

  return providers.map((provider) => {
      const storedSecret = secretMap[provider.id]?.trim() || '';
      return storedSecret ? { ...provider, apiKey: storedSecret } : { ...provider, apiKey: '' };
    });
}

export function sanitizeProviderForDisk(provider: Provider): Provider {
  if (!hasElectronDesktopBridge()) {
    return provider;
  }

  if (!provider.apiKey) {
    return provider;
  }

  return {
    ...provider,
    apiKey: '',
  };
}

export async function syncProviderSecrets(providers: Provider[]): Promise<void> {
  if (!hasElectronDesktopBridge()) {
    return;
  }

  const aiProviderSecretCommands = await getAIProviderSecretCommands();
  await mapWithConcurrencyLimit(
    providers,
    MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
    async (provider) => {
      const apiKey = provider.apiKey?.trim() || '';
      if (apiKey) {
        await aiProviderSecretCommands.setProviderSecret(provider.id, apiKey);
      } else {
        await aiProviderSecretCommands.deleteProviderSecret(provider.id);
      }
    }
  );
}

export async function deleteProviderSecretsBestEffort(
  providerIds: Iterable<string>,
  deletedProviderSecrets: Set<string>,
): Promise<void> {
  if (!hasElectronDesktopBridge()) {
    return;
  }

  const safeProviderIds = Array.from(new Set(providerIds))
    .filter((providerId) => isSafeProviderId(providerId) && !deletedProviderSecrets.has(providerId));
  if (safeProviderIds.length === 0) {
    return;
  }

  const aiProviderSecretCommands = await getAIProviderSecretCommands();
  await mapWithConcurrencyLimit(
    safeProviderIds,
    MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
    async (providerId) => {
      try {
        await aiProviderSecretCommands.deleteProviderSecret(providerId);
        deletedProviderSecrets.add(providerId);
      } catch {
      }
    }
  );
}
