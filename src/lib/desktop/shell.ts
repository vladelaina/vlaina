import { getElectronBridge } from '@/lib/electron/bridge';

export async function openExternalUrl(url: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  await bridge.shell.openExternal(url);
}

export async function revealItemInFolder(filePath: string): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Open file location is only available in the desktop app.');
  }

  await bridge.shell.revealItem(filePath);
}
