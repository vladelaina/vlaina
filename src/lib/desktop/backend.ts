import { getElectronBridge } from '@/lib/electron/bridge';
import {
  deleteDesktopAIProviderSecret,
  getDesktopAIProviderSecrets,
  setDesktopAIProviderSecret,
} from './secrets';

export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: {
    webFallback?: T;
    throwOnWeb?: boolean;
    webErrorMessage?: string;
  }
): Promise<T | undefined> {
  const bridge = getElectronBridge();
  if (!bridge) {
    if (options?.throwOnWeb) {
      throw new Error(options.webErrorMessage || `Command '${command}' is not available.`);
    }

    return options?.webFallback;
  }

  switch (command) {
    case 'open_in_system_file_manager':
      await bridge.shell.revealItem(String(args?.path ?? ''));
      return undefined;
    case 'get_ai_provider_secrets':
      return await getDesktopAIProviderSecrets((args?.providerIds as string[]) ?? []) as T;
    case 'set_ai_provider_secret':
      await setDesktopAIProviderSecret(String(args?.providerId ?? ''), String(args?.apiKey ?? ''));
      return undefined;
    case 'delete_ai_provider_secret':
      await deleteDesktopAIProviderSecret(String(args?.providerId ?? ''));
      return undefined;
    case 'create_billing_checkout':
      return await bridge.account.createBillingCheckout(String(args?.tier ?? '')) as T;
    default:
      throw new Error(`Unsupported desktop command: ${command}`);
  }
}

export function hasBackendCommands(): boolean {
  return getElectronBridge() !== null;
}

export async function createDesktopBillingCheckout(tier: string) {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron desktop bridge is not available.');
  }

  return bridge.account.createBillingCheckout(tier);
}
