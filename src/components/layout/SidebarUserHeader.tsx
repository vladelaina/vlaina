import { Icon } from '@/components/ui/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
    return (
        <div
            className="group/header flex items-center px-3 h-10 w-full gap-1"
            data-tauri-drag-region
        >
            <WorkspaceSwitcher onOpenSettings={onOpenSettings} />

            <div className="flex-1 h-full" data-tauri-drag-region />

            <button
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className={cn(
                    "group flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                    "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                    iconButtonStyles
                )}
            >
                <>
                    <Icon name="nav.sidebarDock" size="md" className="group-hover:hidden" />
                    <Icon name="nav.collapse" size="md" className="hidden group-hover:block" />
                </>
            </button>
        </div>
    );
}
