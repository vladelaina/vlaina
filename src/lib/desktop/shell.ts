import { getElectronBridge } from '@/lib/electron/bridge';

export async function openExternalUrl(url: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron shell bridge is not available.');
  }

  await bridge.shell.openExternal(url);
}

export async function revealItemInFolder(filePath: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron shell bridge is not available.');
  }

  await bridge.shell.revealItem(filePath);
}
