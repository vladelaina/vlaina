import { useEffect } from 'react';
import { isToggleShortcutsBinding } from '@/lib/shortcuts';

interface UseModuleShortcutsDialogOptions {
  enabled?: boolean;
  onToggle: () => void;
}

export function useModuleShortcutsDialog({ enabled = true, onToggle }: UseModuleShortcutsDialogOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isToggleShortcutsBinding(event)) {
        return;
      }
      event.preventDefault();
      onToggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onToggle]);
}
