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
    const sidebarHeaderHovered = useUIStore(s => s.sidebarHeaderHovered);
    const setSidebarHeaderHovered = useUIStore(s => s.setSidebarHeaderHovered);

    const startDrag = useCallback(async () => {
        await getCurrentWindow().startDragging();
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
            >
                <ChevronsLeft className="w-4 h-4" />
            </button>
        </div>
    );
}
