import React from 'react';
import {
    Inbox,
    Calendar,
    PieChart,
    ClipboardList,
} from 'lucide-react';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';

export function TodoSidebar() {
    const { activeGroupId, setActiveGroup } = useGroupStore();

    const navItems = [
        { id: 'all', label: 'Tasks', icon: ClipboardList },
        { id: 'progress', label: 'Progress', icon: PieChart },
        { id: 'today', label: 'Today', icon: Calendar },
        { id: DEFAULT_GROUP_ID, label: 'Inbox', icon: Inbox },
    ];

    const NavButton = ({ item }: { item: { id: string, label: string, icon: React.ElementType } }) => {
        const isActive = activeGroupId === item.id;
        const Icon = item.icon;

        return (
            <button
                onClick={() => setActiveGroup(item.id)}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-[15px] rounded-lg transition-colors duration-200",
                    isActive
                        ? "text-zinc-900 dark:text-zinc-100 font-medium" // Active: Dark/Bold, No BG
                        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" // Default: Light -> Hover: Dark
                )}
            >
                <Icon
                    className={cn(
                        "w-5 h-5",
                        isActive ? "stroke-[2]" : "stroke-[1.5]"
                    )}
                />
                <span>{item.label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full group bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {navItems.map(item => (
                    <NavButton key={item.id} item={item} />
                ))}

                <div className="pt-4">
                    <ColorFilter />
                </div>
            </div>
        </div>
    );
}
