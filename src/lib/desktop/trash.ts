import { getElectronBridge } from '@/lib/electron/bridge';

export async function moveDesktopItemToTrash(filePath: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron shell bridge is not available.');
  }

  await bridge.shell.trashItem(filePath);
}
