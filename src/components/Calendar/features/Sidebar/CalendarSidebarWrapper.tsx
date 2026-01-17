import { MiniCalendar } from './MiniCalendar';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { useUIStore } from '@/stores/uiSlice';


export function CalendarSidebarWrapper() {
  const { toggleSidebar } = useUIStore();

  return (
    <div className="flex flex-col h-full group">
      {/* Header Region - Matches TitleBar height */}
      <SidebarUserHeader toggleSidebar={toggleSidebar} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
        <MiniCalendar />
      </div>
    </div>
  );
}
