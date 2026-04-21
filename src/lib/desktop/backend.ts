import { getElectronBridge } from '@/lib/electron/bridge';

export function hasElectronDesktopBridge(): boolean {
  return getElectronBridge()?.platform === 'electron';
}

export async function createElectronBillingCheckout(tier: string) {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron desktop bridge is not available.');
  }

  return bridge.account.createBillingCheckout(tier);
}
