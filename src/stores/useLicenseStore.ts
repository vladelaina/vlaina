import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Simplified license store
 * 
 * PRO status is now determined by the cloud API during GitHub sync.
 * The license key is bound to the user's GitHub account (email), not device.
 * All verification happens server-side at sync time.
 */

interface LicenseState {
  // PRO status (set by cloud API during sync)
  isProUser: boolean;
  // License key (masked, for display only)
  licenseKey: string | null;
  // Expiry timestamp (seconds)
  expiresAt: number | null;
  // Last check timestamp
  lastCheckedAt: number | null;
}

interface LicenseActions {
  // Set PRO status (called by sync process)
  setProStatus: (isPro: boolean, licenseKey?: string | null, expiresAt?: number | null) => void;
  // Clear PRO status
  clearProStatus: () => void;
  // Get expiry days remaining
  getExpiryDaysRemaining: () => number | null;
}

type LicenseStore = LicenseState & LicenseActions;

export const useLicenseStore = create<LicenseStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isProUser: false,
      licenseKey: null,
      expiresAt: null,
      lastCheckedAt: null,

      // Set PRO status (called by sync process after cloud validation)
      setProStatus: (isPro, licenseKey = null, expiresAt = null) => {
        set({
          isProUser: isPro,
          licenseKey,
          expiresAt,
          lastCheckedAt: Math.floor(Date.now() / 1000),
        });
      },

      // Clear PRO status
      clearProStatus: () => {
        set({
          isProUser: false,
          licenseKey: null,
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
      name: 'nekotick-license',
      partialize: (state) => ({
        isProUser: state.isProUser,
        licenseKey: state.licenseKey,
        expiresAt: state.expiresAt,
        lastCheckedAt: state.lastCheckedAt,
      }),
    }
  )
);
