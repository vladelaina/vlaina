import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarUserHeaderProps {
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ toggleSidebar }: SidebarUserHeaderProps) {
    const [showCollapse, setShowCollapse] = useState(false);

    return (
        <div
            className="vlaina-drag-region flex items-center px-3 h-10 w-full gap-1"
            onMouseEnter={() => setShowCollapse(true)}
            onMouseLeave={() => setShowCollapse(false)}
            onFocus={() => setShowCollapse(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setShowCollapse(false);
                }
            }}
        >
            <WorkspaceSwitcher />
            <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className={cn(
                    "vlaina-no-drag flex h-full min-w-0 flex-1 items-center justify-end bg-transparent",
                    iconButtonStyles
                )}
            >
                <span
                    className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-[background-color,opacity]",
                        showCollapse && "opacity-100",
                        "hover:bg-[#f5f5f5] dark:hover:bg-white/10"
                    )}
                >
                    <Icon name="nav.collapse" size="md" />
                </span>
            </button>
        </div>
    );
}
