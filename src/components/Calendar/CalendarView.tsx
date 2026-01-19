import { useEffect } from 'react';
import { TimeGrid } from './features/Grid/TimeGrid';
import { DayGrid } from './features/Grid/DayGrid';
import { MonthGrid } from './features/Grid/MonthGrid';
import { EventEditForm } from './features/ContextPanel/EventEditForm';
import { CalendarDetailPanel } from './index';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useCalendarKeyboard } from './hooks/useCalendarKeyboard';
import { useCalendarZoom } from './hooks/useCalendarZoom';

interface CalendarViewProps {
  onToggleTask?: (id: string) => void;
}

export function CalendarView({ onToggleTask }: CalendarViewProps) {
  const {
    load, viewMode, showContextPanel,
    editingEventId, editingEventPosition, closeEditingEvent, events,
    deleteEvent
  } = useCalendarStore();

  const editingEvent = editingEventId ? events.find(e => e.uid === editingEventId) : null;

  // Initialize & Hooks
  useEffect(() => { load(); }, [load]);
  useCalendarKeyboard();
  useCalendarZoom();

  // Global click listener for calendar specific logic
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!editingEventId) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-panel]')) return;
      if (target.closest('.event-block')) return;
      if (target.closest('[data-event-context-menu]')) return;
      if (target.closest('#time-grid-container')) return;
      if (target.closest('[data-no-auto-close]')) return;

      const editingEvent = events.find(e => e.uid === editingEventId);
      if (editingEvent && !editingEvent.summary.trim()) {
        deleteEvent(editingEventId);
      }
      closeEditingEvent();
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [editingEventId, closeEditingEvent, events, deleteEvent]);

  const renderGrid = () => {
    switch (viewMode) {
      case 'day': return <DayGrid onToggle={onToggleTask} />;
      case 'week': return <TimeGrid onToggle={onToggleTask} />;
      case 'month': return <MonthGrid />;
      default: return <TimeGrid onToggle={onToggleTask} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Grid Area */}
      <main className="flex-1 min-w-0 flex flex-col relative neko-scrollbar" id="time-grid-container">
        {renderGrid()}
      </main>

      {/* Right Detail Panel */}
      {showContextPanel && (
        <ResizablePanel
          storageKey="calendar_panel_width"
          minWidth={280}
          maxWidth={800}
          defaultWidth={320}
          className="h-full"
        >
           <CalendarDetailPanel />
        </ResizablePanel>
      )}

      {/* Floating editor */}
      {!showContextPanel && editingEvent && (
        <EventEditForm
          event={editingEvent}
          mode="floating"
          position={editingEventPosition || undefined}
        />
      )}
    </div>
  );
}
