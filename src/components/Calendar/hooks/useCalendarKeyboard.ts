import { useEffect } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';

export function useCalendarKeyboard() {
  const { selectedEventId, setSelectedEventId, deleteEvent, editingEventId } = useCalendarStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedEventId) {
        e.preventDefault();
        deleteEvent(selectedEventId);
        setSelectedEventId(null);
        return;
      }

      if (e.key === 'Escape' && selectedEventId) {
        setSelectedEventId(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, editingEventId, deleteEvent, setSelectedEventId]);
}