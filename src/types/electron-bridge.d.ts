import type { VlainaDesktopApi } from '@/lib/electron/bridge';

declare global {
  interface Window {
    __VL_ELECTRON__?: {
      platform: 'electron';
    };
    vlainaDesktop?: VlainaDesktopApi;
  }
}

export {};
