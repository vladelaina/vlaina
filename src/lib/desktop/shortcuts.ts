import { getElectronBridge } from '@/lib/electron/bridge';

export function onDesktopOpenMarkdownFileShortcut(callback: () => void): () => void {
  return getElectronBridge()?.shortcuts?.onOpenMarkdownFile?.(callback) ?? (() => {});
}

export function onDesktopOpenMarkdownFile(callback: (filePath: string) => void): () => void {
  return getElectronBridge()?.app?.onOpenMarkdownFile?.(callback) ?? (() => {});
}
