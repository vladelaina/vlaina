import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HOLIDAY_REGIONS, getGoogleHolidayUrl, fetchHolidayICS, type HolidayRegion } from '@/lib/calendar/holidayService';
import { parseICS } from '@/lib/ics/parser';
import type { NekoEvent } from '@/lib/ics/types';

interface HolidayState {
  // Persistence
  subscribedRegionId: string | null;
  
  // Memory
  holidays: NekoEvent[];
  isLoading: boolean;
  
  // Actions
  subscribe: (regionId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useHolidayStore = create<HolidayState>()(
  persist(
    (set, get) => ({
      subscribedRegionId: null,
      holidays: [],
      isLoading: false,

      subscribe: async (regionId) => {
        set({ subscribedRegionId: regionId, holidays: [] });
        if (regionId) {
          await get().refresh();
        }
      },

      refresh: async () => {
        const { subscribedRegionId } = get();
        if (!subscribedRegionId) return;

        const region = HOLIDAY_REGIONS.find(r => r.id === subscribedRegionId);
        if (!region) return;

        set({ isLoading: true });
        
        const url = getGoogleHolidayUrl(region);
        const icsContent = await fetchHolidayICS(url);
        
        if (icsContent) {
          // Parse as standard NekoEvents, but tagged as holidays
          const events = parseICS(icsContent, 'holidays');
          
          // Add a special flag or treat them differently in UI if needed
          set({ holidays: events, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'nekotick-holiday-storage',
      partialize: (state) => ({ subscribedRegionId: state.subscribedRegionId }), // Only persist subscription choice
    }
  )
);
