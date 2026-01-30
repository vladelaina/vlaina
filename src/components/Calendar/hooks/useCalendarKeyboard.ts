/**
 * Calendar Keyboard Shortcuts Hook
 */

import { useEffect } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';

export function useCalendarKeyboard() {
  const { selectedEventId, setSelectedEventId, deleteEvent, editingEventId } = useCalendarStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If editing (input focused), don't handle shortcuts
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Backspace or Delete to delete selected event
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedEventId) {
        e.preventDefault();
        deleteEvent(selectedEventId);
        setSelectedEventId(null);
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape' && selectedEventId) {
        setSelectedEventId(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, editingEventId, deleteEvent, setSelectedEventId]);
}