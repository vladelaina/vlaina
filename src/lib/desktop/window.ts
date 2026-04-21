import { getElectronBridge } from '@/lib/electron/bridge';
import type { WindowLaunchViewMode } from './launchContext';

export interface WindowSize {
  width: number;
  height: number;
}

function getWindowApi() {
  const bridge = getElectronBridge();
  return bridge?.window ?? null;
}

export const desktopWindow = {
  minimize() {
    return getWindowApi()?.minimize() ?? Promise.resolve();
  },

  toggleMaximize() {
    return getWindowApi()?.toggleMaximize() ?? Promise.resolve(false);
  },

  close() {
    return getWindowApi()?.close() ?? Promise.resolve();
  },

  confirmClose() {
    return getWindowApi()?.confirmClose() ?? Promise.resolve();
  },

  isMaximized() {
    return getWindowApi()?.isMaximized() ?? Promise.resolve(false);
  },

  setResizable(resizable: boolean) {
    return getWindowApi()?.setResizable(resizable) ?? Promise.resolve();
  },

  setMaximizable(maximizable: boolean) {
    return getWindowApi()?.setMaximizable(maximizable) ?? Promise.resolve();
  },

  setMinSize(size: WindowSize) {
    return getWindowApi()?.setMinSize(size.width, size.height) ?? Promise.resolve();
  },

  setSize(size: WindowSize) {
    return getWindowApi()?.setSize(size.width, size.height) ?? Promise.resolve();
  },

  center() {
    return getWindowApi()?.center() ?? Promise.resolve();
  },

  getSize() {
    return getWindowApi()?.getSize() ?? Promise.resolve({ width: 0, height: 0 });
  },

  getLabel() {
    return getWindowApi()?.getLabel() ?? Promise.resolve(null);
  },

  focus(label: string) {
    return getWindowApi()?.focus(label) ?? Promise.resolve(false);
  },

  toggleFullscreen() {
    return getWindowApi()?.toggleFullscreen() ?? Promise.resolve(false);
  },

  create(options?: {
    vaultPath?: string | null;
    notePath?: string | null;
    viewMode?: WindowLaunchViewMode | null;
  }) {
    return getWindowApi()?.create(options) ?? Promise.resolve();
  },

  onCloseRequested(callback: () => void) {
    return getWindowApi()?.onCloseRequested(callback) ?? (() => {});
  },
};
