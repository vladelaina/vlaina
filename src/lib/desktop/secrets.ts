import { getElectronBridge } from '@/lib/electron/bridge';

function getSecretsApi() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron secrets bridge is not available.');
  }
  return bridge.secrets;
}

export function getDesktopAIProviderSecrets(providerIds: string[]) {
  return getSecretsApi().getAIProviderSecrets(providerIds);
}

export function setDesktopAIProviderSecret(providerId: string, apiKey: string) {
  return getSecretsApi().setAIProviderSecret(providerId, apiKey);
}

export function deleteDesktopAIProviderSecret(providerId: string) {
  return getSecretsApi().deleteAIProviderSecret(providerId);
}
