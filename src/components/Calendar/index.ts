// Calendar module exports
export { CalendarView } from './CalendarView';
// CalendarSidebar wrapper with proper padding
export { CalendarSidebarWrapper as CalendarSidebar } from './features/Sidebar/CalendarSidebarWrapper';

// Hooks
export { useCalendarEvents } from './hooks/useCalendarEvents';
export { useCalendarKeyboard } from './hooks/useCalendarKeyboard';
export { useCalendarZoom } from './hooks/useCalendarZoom';
export { useAutoScroll } from './hooks/useAutoScroll';

// Utils
export { calculateEventLayout } from './utils/eventLayout';
export * from './utils/timeUtils';