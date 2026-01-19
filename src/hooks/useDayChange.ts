import { useEffect, useRef } from 'react';
import { useProgressStore } from '../stores/useProgressStore';

// Day Change Hook - Detects day changes and triggers daily state validation
export function useDayChange() {
  const { validateDailyState } = useProgressStore();
  const lastCheck = useRef<string>(new Date().toDateString());

  useEffect(() => {
    // 1. Check immediately on mount
    validateDailyState();

    // 2. Setup Visibility Change Listener (When user switches back to tab/app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const today = new Date().toDateString();
        if (today !== lastCheck.current) {

          lastCheck.current = today;
          validateDailyState();
        }
      }
    };

    // 3. Setup Interval (Midnight check for active sessions)
    const intervalId = setInterval(() => {
      const today = new Date().toDateString();
      if (today !== lastCheck.current) {

        lastCheck.current = today;
        validateDailyState();
      }
    }, 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [validateDailyState]);
}
