import type { VlainaDesktopApi } from '@/lib/electron/bridge';

declare global {
  interface Window {
    vlainaDesktop?: VlainaDesktopApi;
  }
}

export {};
