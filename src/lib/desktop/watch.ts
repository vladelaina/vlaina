import { getElectronBridge } from '@/lib/electron/bridge';

export interface DesktopWatchEvent {
  type:
    | { remove: { kind: string } }
    | { create: { kind: string } }
    | { modify: { kind: string; mode?: string } };
  paths: string[];
}

export async function watchDesktopPath(
  watchPath: string,
  callback: (event: DesktopWatchEvent) => void | Promise<void>,
): Promise<() => Promise<void>> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron fs bridge is not available.');
  }

  return bridge.fs.watch(watchPath, callback);
}
