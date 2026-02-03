import { useEffect, useRef } from 'react';
import { useProgressStore } from '../stores/useProgressStore';

export function useDayChange() {
  const { validateDailyState } = useProgressStore();
  const lastCheck = useRef<string>(new Date().toDateString());

  useEffect(() => {
    validateDailyState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const today = new Date().toDateString();
        if (today !== lastCheck.current) {
          lastCheck.current = today;
          validateDailyState();
        }
      }
    };

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
