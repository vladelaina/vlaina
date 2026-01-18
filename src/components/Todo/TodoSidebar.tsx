import React from 'react';
import {
    ClipboardList,
    CalendarDays,
    CheckCircle2,
    Archive,
    Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';

export function TodoSidebar() {
    const { activeGroupId, setActiveGroup, groups } = useGroupStore();

    const navItems = [
        { id: 'all', label: 'All Tasks', icon: ClipboardList },
        { id: 'today', label: 'Today', icon: CalendarDays },
        { id: 'completed', label: 'Completed', icon: CheckCircle2 },
        { id: '__archive__', label: 'Archive', icon: Archive },
    ];

    return (
        <div className="flex flex-col h-full group">
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">

                {/* Main Navigation */}
                <div className="space-y-0.5">
                    <div className="px-2 text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Views
                    </div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                // For now, mapping 'all', 'today' etc to specific filters or groups could be implemented later.
                                // Currently just setting active group if it exists, or just visual selection
                                if (item.id === '__archive__') setActiveGroup('__archive__');
                            }}
                            className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                                activeGroupId === item.id
                                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Groups / Projects */}
                <div className="space-y-0.5">
                    <div className="flex items-center justify-between px-2 mb-2">
                        <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                            Lists
                        </div>
                    </div>

                    {groups.map(group => (
                        <button
                            key={group.id}
                            onClick={() => setActiveGroup(group.id)}
                            className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                                activeGroupId === group.id
                                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                            )}
                        >
                            <Inbox className="w-4 h-4 opacity-70" />
                            <span className="truncate">{group.name}</span>
                            {group.id === activeGroupId && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
