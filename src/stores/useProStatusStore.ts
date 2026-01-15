import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * PRO Status Store
 * 
 * PRO status is determined by the cloud API during GitHub sync.
 * Subscription is bound to the user's GitHub account.
 * All verification happens server-side at sync time.
 */

interface ProStatusState {
  // PRO status (set by cloud API during sync)
  isProUser: boolean;
  // Expiry timestamp (seconds)
  expiresAt: number | null;
  // Last check timestamp
  lastCheckedAt: number | null;
}

interface ProStatusActions {
  // Set PRO status (called by sync process)
  setProStatus: (isPro: boolean, expiresAt?: number | null) => void;
  // Clear PRO status
  clearProStatus: () => void;
  // Get expiry days remaining
  getExpiryDaysRemaining: () => number | null;
}

type ProStatusStore = ProStatusState & ProStatusActions;

export const useProStatusStore = create<ProStatusStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isProUser: false,
      expiresAt: null,
      lastCheckedAt: null,

      // Set PRO status (called by sync process after cloud validation)
      setProStatus: (isPro, expiresAt = null) => {
        set({
          isProUser: isPro,
          expiresAt,
          lastCheckedAt: Math.floor(Date.now() / 1000),
        });
      },

      // Clear PRO status
      clearProStatus: () => {
        set({
          isProUser: false,
          expiresAt: null,
          lastCheckedAt: null,
        });
      },

      // Get expiry days remaining
      getExpiryDaysRemaining: () => {
        const { expiresAt, isProUser } = get();
        if (!isProUser || !expiresAt) return null;
        
        const now = Math.floor(Date.now() / 1000);
        const remaining = expiresAt - now;
        if (remaining <= 0) return 0;
        
        return Math.ceil(remaining / (24 * 60 * 60));
      },
    }),
    {
      name: 'nekotick-pro-status',
      partialize: (state) => ({
        isProUser: state.isProUser,
        expiresAt: state.expiresAt,
        lastCheckedAt: state.lastCheckedAt,
      }),
    }
  )
);
