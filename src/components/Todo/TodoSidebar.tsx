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

    // Define the exact navigation structure requested: Tasks -> Progress -> Today -> Inbox
    const navItems = [
        { id: 'all', label: 'Tasks', icon: ClipboardList },
        { id: 'progress', label: 'Progress', icon: PieChart },
        { id: 'today', label: 'Today', icon: Calendar },
        { id: DEFAULT_GROUP_ID, label: 'Inbox', icon: Inbox },
    ];

    const NavButton = ({ item }: { item: { id: string, label: string, icon: React.ElementType, color?: string } }) => {
        const isActive = activeGroupId === item.id;
        const Icon = item.icon;

        // Use custom color if provided, otherwise fall back to default styling
        const iconColorClass = item.color
            ? item.color
            : (isActive ? '' : '');

        return (
            <button
                onClick={() => setActiveGroup(item.id)}
                className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-200",
                    isActive
                        ? "bg-zinc-200/60 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
            >
                <Icon className={cn(
                    "w-4 h-4",
                    isActive ? "stroke-[2]" : "stroke-[1.5]",
                    iconColorClass
                )} />
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
