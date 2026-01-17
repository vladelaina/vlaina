// Calendar module exports
export { CalendarPage } from './CalendarPage';
export { ViewSwitcher as CalendarToolbar } from './features/ViewSwitcher';
// CalendarContextPanel removed in favor of CalendarTaskPanel
// CalendarSidebar wrapper with proper padding
export { CalendarSidebarWrapper as CalendarSidebar } from './features/Sidebar/CalendarSidebarWrapper';

// Detail panel for right sidebar
export { CalendarDetailPanel } from './features/ContextPanel/CalendarDetailPanel';// Hooks
export { useCalendarEvents } from './hooks/useCalendarEvents';
export { useCalendarKeyboard } from './hooks/useCalendarKeyboard';
export { useCalendarZoom } from './hooks/useCalendarZoom';
export { useAutoScroll } from './hooks/useAutoScroll';

// Utils
export { calculateEventLayout } from './utils/eventLayout';
export * from './utils/timeUtils';
