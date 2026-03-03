import { Icon } from '@/components/ui/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
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
                            "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                            "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                            iconButtonStyles
                        )}
                    >
                        <Icon name="common.compose" size="md" />
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
                            "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                            "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                            iconButtonStyles
                        )}
                    >
                        <Icon name="common.search" size="md" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={2}>
                    <span className="flex items-center gap-1.5">
                        Search
                        <ShortcutKeys keys={['Ctrl', 'F']} />
                    </span>
                </TooltipContent>
            </Tooltip>

            {/* Collapse button */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                    "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                    iconButtonStyles
                )}
            >
                <Icon name="sidebar.collapse" size="md" />
            </button>
        </div>
    );
}
