import { ChevronsLeft } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useCallback } from 'react';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
    const { sidebarHeaderHovered, setSidebarHeaderHovered } = useUIStore();

    const startDrag = useCallback(async () => {
        // Delay slightly to allow React state updates
        setTimeout(async () => {
            await getCurrentWindow().startDragging();
        }, 100);
    }, []);

    return (
        <div
            className="flex items-center px-3 h-10 w-full"
            onMouseEnter={() => setSidebarHeaderHovered(true)}
            onMouseLeave={() => setSidebarHeaderHovered(false)}
        >
            {/* User info with dropdown */}
            <WorkspaceSwitcher onOpenSettings={onOpenSettings} />

            {/* Draggable Spacer Region */}
            <div
                className="flex-1 h-full cursor-default"
                onMouseDown={startDrag}
                data-tauri-drag-region
            />

            {/* Collapse button - hidden by default, visible on header hover */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                    iconButtonStyles,
                    sidebarHeaderHovered ? "opacity-100" : "opacity-0",
                    "transition-opacity"
                )}
                title="Collapse Sidebar"
            >
                <ChevronsLeft className="w-4 h-4" />
            </button>
        </div>
    );
}
