import type { VlainaDesktopApi } from '@/lib/electron/bridge';
import type { VlainaE2EBridge } from '@/lib/e2e/syncE2EBridge';

declare global {
  interface Window {
    vlainaDesktop?: VlainaDesktopApi;
    __vlainaE2E?: VlainaE2EBridge;
  }
}

export {};
