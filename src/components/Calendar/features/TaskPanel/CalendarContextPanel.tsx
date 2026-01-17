import React from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { EventEditForm } from '../ContextPanel/EventEditForm';

export function CalendarContextPanel() {
    const { editingEventId, events } = useCalendarStore();
    const editingEvent = editingEventId ? events.find(e => e.id === editingEventId) : null;

    if (!editingEvent) {
        return null;
    }

    return (
        <div data-context-panel className="h-full overflow-visible bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
            <EventEditForm event={editingEvent} mode="embedded" />
        </div>
    );
}
