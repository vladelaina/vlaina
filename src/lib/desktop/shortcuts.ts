import { getElectronBridge } from '@/lib/electron/bridge';

export function onDesktopOpenMarkdownFileShortcut(callback: () => void): () => void {
  return getElectronBridge()?.shortcuts?.onOpenMarkdownFile?.(callback) ?? (() => {});
}
