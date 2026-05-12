import { useEffect, useState } from 'react';

export function useDelayedVisibleFlag(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [active, delayMs]);

  return visible;
}
