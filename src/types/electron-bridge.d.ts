import type { DesktopApi } from '@/lib/electron/bridge';
import type { E2EBridge } from '@/lib/e2e/syncE2EBridge';

declare global {
  interface Window {
    vlainaDesktop?: DesktopApi;
    __vlainaE2E?: E2EBridge;
  }
}

export {};
