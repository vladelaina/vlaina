import { MiniCalendar } from '../DateSelector/MiniCalendar';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { EventEditForm } from '../ContextPanel/EventEditForm';

export function CalendarSidebarWrapper() {
  const { editingEventId, events, allEvents } = useCalendarStore();

  // Try finding in filtered events first, then fall back to all events
  const editingEvent = editingEventId
      ? (events.find(e => e.uid === editingEventId) || allEvents.find(e => e.uid === editingEventId))
      : null;

  return (
    <div className="flex flex-col h-full group overflow-hidden">
      {/* Mini Calendar (Navigation) */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <MiniCalendar />
      </div>

      {/* Inspector / Details Panel (Context) */}
      {editingEvent && (
        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col bg-zinc-50/30 dark:bg-zinc-900/30">
           <EventEditForm event={editingEvent} mode="embedded" />
        </div>
      )}
    </div>
  );
}
