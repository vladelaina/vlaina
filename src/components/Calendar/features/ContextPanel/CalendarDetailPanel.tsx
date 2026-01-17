import { useCalendarStore } from '@/stores/useCalendarStore';
import { EventEditForm } from './EventEditForm';
import { X } from 'lucide-react';

export function CalendarDetailPanel() {
    const { editingEventId, events, allEvents, toggleContextPanel } = useCalendarStore();

    // Try finding in filtered events first, then fall back to all events
    const editingEvent = editingEventId
        ? (events.find(e => e.uid === editingEventId) || allEvents.find(e => e.uid === editingEventId))
        : null;

    if (!editingEvent) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-4 text-center">
                <p className="text-sm">Select an event to view details</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50">
                <h3 className="font-medium text-sm text-zinc-700 dark:text-zinc-200">
                    Event Details
                </h3>
                <button
                    onClick={() => toggleContextPanel()}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <EventEditForm event={editingEvent} mode="embedded" />
            </div>
        </div>
    );
}
