import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProStatusState {
  isProUser: boolean;
  expiresAt: number | null;
  lastCheckedAt: number | null;
  isChecking: boolean;
}

interface ProStatusActions {
  setProStatus: (isPro: boolean, expiresAt?: number | null) => void;
  setIsChecking: (isChecking: boolean) => void;
  clearProStatus: () => void;
  getExpiryDaysRemaining: () => number | null;
}

type ProStatusStore = ProStatusState & ProStatusActions;

export const useProStatusStore = create<ProStatusStore>()(
  persist(
    (set, get) => ({
      isProUser: false,
      expiresAt: null,
      lastCheckedAt: null,
      isChecking: false,

      setIsChecking: (isChecking) => set({ isChecking }),

      setProStatus: (isPro, expiresAt = null) => {
        set({
          isProUser: isPro,
          expiresAt,
          lastCheckedAt: Math.floor(Date.now() / 1000),
          isChecking: false,
        });
      },

      clearProStatus: () => {
        set({
          isProUser: false,
          expiresAt: null,
          lastCheckedAt: null,
          isChecking: false,
        });
      },

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
