import { useEffect } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';

export function useShortcuts() {
  const { toggleDrawer } = useGroupStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B: Toggle Drawer
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDrawer]);
}
