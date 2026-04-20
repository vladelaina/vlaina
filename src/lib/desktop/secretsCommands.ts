import {
  deleteDesktopAIProviderSecret,
  getDesktopAIProviderSecrets,
  setDesktopAIProviderSecret,
} from './secrets';

export const aiProviderSecretCommands = {
  async getProviderSecrets(providerIds: string[]): Promise<Record<string, string>> {
    return await getDesktopAIProviderSecrets(providerIds);
  },

  async setProviderSecret(providerId: string, apiKey: string): Promise<void> {
    await setDesktopAIProviderSecret(providerId, apiKey);
  },

  async deleteProviderSecret(providerId: string): Promise<void> {
    await deleteDesktopAIProviderSecret(providerId);
  },
};
