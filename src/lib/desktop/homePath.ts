import { getElectronBridge } from '@/lib/electron/bridge';

let cachedHomePath: string | null | undefined;

export async function getDesktopHomePath(): Promise<string | null> {
  if (cachedHomePath !== undefined) {
    return cachedHomePath;
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    cachedHomePath = null;
    return cachedHomePath;
  }

  try {
    cachedHomePath = await bridge.path.homeDir();
  } catch {
    cachedHomePath = null;
  }

  return cachedHomePath;
}

export function getCachedDesktopHomePath(): string | null {
  return cachedHomePath ?? null;
}
