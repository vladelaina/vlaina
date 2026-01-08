import { useEffect, useState, useCallback, useMemo } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { SettingsModal } from '@/components/Settings';
import { CalendarPage, CalendarToolbar, CalendarTaskPanel } from '@/components/Calendar';
import { CalendarHeaderControl } from '@/components/Calendar/features/Grid/CalendarHeaderControl';
import { NotesPage } from '@/components/Notes/NotesPage';
import { Layout } from '@/components/layout';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useGroupStore } from '@/stores/useGroupStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVimShortcuts } from '@/hooks/useVimShortcuts';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useLicenseInit } from '@/hooks/useLicenseInit';
import { startOfWeek, addDays, startOfDay, addMinutes } from 'date-fns';
import { CALENDAR_CONSTANTS, getSnapMinutes } from '@/components/Calendar/utils/timeUtils';

const { GUTTER_WIDTH } = CALENDAR_CONSTANTS;

function AppContent() {
  const { loadData, updateTaskTime, updateTaskEstimation } = useGroupStore();
  const { showContextPanel, selectedDate, hourHeight, viewMode, dayCount } = useCalendarStore();
  const { appViewMode } = useUIStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), []);

  const shortcutHandlers = useMemo(() => ({
    'open-settings': toggleSettings,
  }), [toggleSettings]);

  useShortcuts({ handlers: shortcutHandlers });

  // Ctrl+Shift+N: Open new window (registered once at app level)
  useEffect(() => {
    const handleNewWindow = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        await windowCommands.createNewWindow();
      }
    };

    window.addEventListener('keydown', handleNewWindow);
    return () => window.removeEventListener('keydown', handleNewWindow);
  }, []);

  // Enable VIM-style keyboard navigation
  useVimShortcuts();

  // Initialize sync status (check connection, refresh tokens if needed)
  useSyncInit();

  // Initialize license status (check PRO status, validate if needed)
  useLicenseInit();

  // Load data on app startup
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Window Unlocker: When we reach the main app, unlock the window!
  useEffect(() => {
    if (!isTauri()) return;

    const unlockWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const appWindow = getCurrentWindow();

      await appWindow.setResizable(true);
      await appWindow.setMaximizable(true);

      // Optional: Enforce a minimum specific size for the app
      await appWindow.setMinSize(new LogicalSize(800, 600));

      // If coming from welcome screen (which is small), resize to workspace size
      const size = await appWindow.outerSize();
      if (size.width < 800) {
        await appWindow.setSize(new LogicalSize(1024, 768));
        await appWindow.center();
      }
    };
    unlockWindow();
  }, []);

  // DnD sensors for cross-panel dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    // Just track that dragging started - the DragOverlay is in CalendarTaskPanel
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;

    const task = active.data.current?.task;
    if (!task) return;

    const gridContainer = document.getElementById('time-grid-container');
    if (!gridContainer) return;

    const rect = gridContainer.getBoundingClientRect();
    const dropRect = event.active.rect.current.translated;
    if (!dropRect) return;

    const x = dropRect.left + 20;
    const y = dropRect.top + 20;

    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      // Calculate day count based on view mode
      const numDays = viewMode === 'week' ? 7 : (dayCount || 1);

      const relativeX = x - rect.left - GUTTER_WIDTH;
      if (relativeX < 0) return;

      const dayWidth = (rect.width - GUTTER_WIDTH) / numDays;
      const dayIndex = Math.floor(relativeX / dayWidth);
      if (dayIndex < 0 || dayIndex >= numDays) return;

      const scrollContainer = document.getElementById('time-grid-scroll');
      const scrollTop = scrollContainer?.scrollTop || 0;

      const relativeY = y - rect.top + scrollTop;
      const totalMinutes = (relativeY / hourHeight) * 60;
      const snapMinutes = getSnapMinutes(hourHeight);
      const snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;

      const weekStart = viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : selectedDate;
      const dayDate = addDays(weekStart, dayIndex);
      const startDate = addMinutes(startOfDay(dayDate), snappedMinutes);

      const endDate = addMinutes(startDate, task.estimatedMinutes || 25);
      updateTaskTime(task.id, startDate.getTime(), endDate.getTime());
      if (!task.estimatedMinutes) {
        updateTaskEstimation(task.id, 25);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Settings Modal - Global */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Conditional View Rendering */}
      {appViewMode === 'calendar' ? (
        /* Calendar Page */
        <Layout
          onOpenSettings={() => setSettingsOpen(true)}
          toolbar={<CalendarToolbar />}
          content={<CalendarHeaderControl />}
          rightPanel={<CalendarTaskPanel />}
          showRightPanel={showContextPanel}
        >
          <CalendarPage />
        </Layout>
      ) : (
        /* Notes Page */
        <Layout
          onOpenSettings={() => setSettingsOpen(true)}
        >
          <NotesPage />
        </Layout>
      )}
    </DndContext>
  );
}

function App() {
  // Prevent default browser zoom behavior on Ctrl+scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Disable browser context menu (right-click menu)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
