import { safeInvoke } from './invoke';

export const aiProviderSecretCommands = {
  async getProviderSecrets(providerIds: string[]): Promise<Record<string, string>> {
    return (
      (await safeInvoke<Record<string, string>>('get_ai_provider_secrets', {
        providerIds,
      }, {
        webFallback: {},
      })) ?? {}
    );
  },

  async setProviderSecret(providerId: string, apiKey: string): Promise<void> {
    await safeInvoke('set_ai_provider_secret', {
      providerId,
      apiKey,
    }, {
      webFallback: undefined,
    });
  },

  async deleteProviderSecret(providerId: string): Promise<void> {
    await safeInvoke('delete_ai_provider_secret', {
      providerId,
    }, {
      webFallback: undefined,
    });
  },
};
