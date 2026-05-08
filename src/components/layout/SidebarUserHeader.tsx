import { Icon } from '@/components/ui/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarUserHeaderProps {
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ toggleSidebar }: SidebarUserHeaderProps) {
    return (
        <div
            className="vlaina-drag-region group/sidebar-user-header relative flex h-10 w-full items-center px-3"
        >
            <div
                className={cn(
                    'vlaina-no-drag flex h-8 w-full items-center justify-between rounded-full border border-transparent bg-transparent px-1 transition-[background-color,box-shadow]',
                    'group-hover/sidebar-user-header:bg-white group-hover/sidebar-user-header:shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]',
                    'group-focus-within/sidebar-user-header:bg-white group-focus-within/sidebar-user-header:shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]'
                )}
            >
                <WorkspaceSwitcher />
                <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                    className={cn(
                        'pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-transparent opacity-0 transition-opacity',
                        'group-hover/sidebar-user-header:pointer-events-auto group-hover/sidebar-user-header:opacity-100',
                        'group-focus-within/sidebar-user-header:pointer-events-auto group-focus-within/sidebar-user-header:opacity-100',
                        iconButtonStyles
                    )}
                >
                    <Icon name="nav.collapse" size="md" />
                </button>
            </div>
        </div>
    );
}
