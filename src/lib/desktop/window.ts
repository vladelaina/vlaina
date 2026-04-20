import { getElectronBridge } from '@/lib/electron/bridge';
import type { WindowLaunchViewMode } from './launchContext';

export interface WindowSize {
  width: number;
  height: number;
}

function getWindowApi() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron window bridge is not available.');
  }
  return bridge.window;
}

export const desktopWindow = {
  minimize() {
    return getWindowApi().minimize();
  },

  toggleMaximize() {
    return getWindowApi().toggleMaximize();
  },

  close() {
    return getWindowApi().close();
  },

  confirmClose() {
    return getWindowApi().confirmClose();
  },

  isMaximized() {
    return getWindowApi().isMaximized();
  },

  setResizable(resizable: boolean) {
    return getWindowApi().setResizable(resizable);
  },

  setMaximizable(maximizable: boolean) {
    return getWindowApi().setMaximizable(maximizable);
  },

  setMinSize(size: WindowSize) {
    return getWindowApi().setMinSize(size.width, size.height);
  },

  setSize(size: WindowSize) {
    return getWindowApi().setSize(size.width, size.height);
  },

  center() {
    return getWindowApi().center();
  },

  getSize() {
    return getWindowApi().getSize();
  },

  getLabel() {
    return getWindowApi().getLabel();
  },

  focus(label: string) {
    return getWindowApi().focus(label);
  },

  toggleFullscreen() {
    return getWindowApi().toggleFullscreen();
  },

  create(options?: {
    vaultPath?: string | null;
    notePath?: string | null;
    viewMode?: WindowLaunchViewMode | null;
  }) {
    return getWindowApi().create(options);
  },

  onCloseRequested(callback: () => void) {
    return getWindowApi().onCloseRequested(callback);
  },
};
