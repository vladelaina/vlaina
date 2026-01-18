import { MiniCalendar } from '../DateSelector/MiniCalendar';

export function CalendarSidebarWrapper() {
  return (
    <div className="flex flex-col h-full group">
      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
        <MiniCalendar />
      </div>
    </div>
  );
}
