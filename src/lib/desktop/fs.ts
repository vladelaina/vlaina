import { getElectronBridge } from '@/lib/electron/bridge';

export const MAX_DESKTOP_BINARY_WRITE_BYTES = 64 * 1024 * 1024;

function assertDesktopBinaryWriteBytes(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_BINARY_WRITE_BYTES) {
    throw new Error('Desktop binary content is too large to write.');
  }
}

export async function writeDesktopBinaryFile(filePath: string, bytes: Uint8Array): Promise<void> {
  assertDesktopBinaryWriteBytes(bytes.byteLength);

  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron fs bridge is not available.');
  }

  await bridge.fs.writeBinaryFile(filePath, bytes);
}
