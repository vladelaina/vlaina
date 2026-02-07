import { MdKeyboardDoubleArrowLeft, MdSearch } from 'react-icons/md';
import { SquarePen } from 'lucide-react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
    const sidebarHeaderHovered = useUIStore(s => s.sidebarHeaderHovered);
    const setSidebarHeaderHovered = useUIStore(s => s.setSidebarHeaderHovered);
    const appViewMode = useUIStore(s => s.appViewMode);

    const handleSearchClick = () => {
        window.dispatchEvent(new Event('neko-open-search'));
    };

    const handleCreateNew = () => {
        window.dispatchEvent(new CustomEvent('neko-create-new', { detail: { view: appViewMode } }));
    };

    return (
        <div
            className="flex items-center px-3 h-10 w-full gap-1"
            onMouseEnter={() => setSidebarHeaderHovered(true)}
            onMouseLeave={() => setSidebarHeaderHovered(false)}
            data-tauri-drag-region
        >
            {/* User info with dropdown */}
            <WorkspaceSwitcher onOpenSettings={onOpenSettings} />

            {/* Simple spacer to push buttons to the right */}
            <div className="flex-1 h-full" data-tauri-drag-region />

            {/* Create New button */}
            <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                    <button
                        onClick={handleCreateNew}
                        className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                            iconButtonStyles
                        )}
                    >
                        <SquarePen className="w-[16px] h-[16px]" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={2}>
                    <span className="text-xs">Create New</span>
                </TooltipContent>
            </Tooltip>

            {/* Search button */}
            <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                    <button
                        onClick={handleSearchClick}
                        className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                            iconButtonStyles
                        )}
                    >
                        <MdSearch className="w-[18px] h-[18px]" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={2}>
                    <span className="flex items-center gap-1.5">
                        Search
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700">Ctrl</kbd>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700">K</kbd>
                    </span>
                </TooltipContent>
            </Tooltip>

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