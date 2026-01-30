import { MdKeyboardDoubleArrowLeft } from 'react-icons/md';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
    const sidebarHeaderHovered = useUIStore(s => s.sidebarHeaderHovered);
    const setSidebarHeaderHovered = useUIStore(s => s.setSidebarHeaderHovered);

    return (
        <div
            className="flex items-center px-3 h-10 w-full"
            onMouseEnter={() => setSidebarHeaderHovered(true)}
            onMouseLeave={() => setSidebarHeaderHovered(false)}
            data-tauri-drag-region
        >
            {/* User info with dropdown */}
            <WorkspaceSwitcher onOpenSettings={onOpenSettings} />

            {/* Simple spacer to push the button to the right */}
            <div className="flex-1 h-full" data-tauri-drag-region />

            {/* Collapse button - hidden by default, visible on header hover */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                    iconButtonStyles,
                    sidebarHeaderHovered ? "opacity-100" : "opacity-0",
                    "transition-opacity"
                )}
            >
                <MdKeyboardDoubleArrowLeft className="w-[18px] h-[18px]" />
            </button>
        </div>
    );
}