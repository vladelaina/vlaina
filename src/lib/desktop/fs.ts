import { getElectronBridge } from '@/lib/electron/bridge';

export async function writeDesktopBinaryFile(filePath: string, bytes: Uint8Array): Promise<void> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron fs bridge is not available.');
  }

  await bridge.fs.writeBinaryFile(filePath, bytes);
}
