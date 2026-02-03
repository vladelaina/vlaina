import { useMemo } from 'react';
import {
    MdInbox,
    MdCalendarToday,
    MdPieChart,
    MdAssignment,
} from 'react-icons/md';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { getTodayKey, formatDateKey } from '@/lib/date';

export function TodoSidebar() {
    const { 
        tasks, 
        activeGroupId, 
        setActiveGroup
    } = useGroupStore();



    const counts = useMemo(() => {
        const c = { inbox: 0, today: 0, all: 0 };
        const todayKey = getTodayKey();

        tasks.forEach((t: any) => {
            if (t.completed) return;
            
            c.all++;
            
            if (t.calendarId === DEFAULT_GROUP_ID) c.inbox++;

            if (t.dtstart) {
                const taskDateKey = formatDateKey(new Date(t.dtstart));
                if (taskDateKey === todayKey) c.today++;
            }
        });
        return c;
    }, [tasks]);



    const NavItem = ({ label, icon: Icon, count, onClick, active }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-colors duration-200 group",
                active
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium" 
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon className={cn("size-[18px]", active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")} />
                <span>{label}</span>
            </div>
            {count > 0 && (
                <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full transition-colors",
                    active 
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" 
                        : "text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                )}>
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-zinc-50/80 dark:bg-zinc-900/50 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 select-none">
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                
                <div className="space-y-0.5">
                    <NavItem 
                        id={DEFAULT_GROUP_ID} 
                        label="Inbox" 
                        icon={MdInbox} 
                        count={counts.inbox}
                        active={activeGroupId === DEFAULT_GROUP_ID}
                        onClick={() => setActiveGroup(DEFAULT_GROUP_ID)}
                    />
                    <NavItem 
                        id="today" 
                        label="Today" 
                        icon={MdCalendarToday} 
                        count={counts.today}
                        active={activeGroupId === 'today'}
                        onClick={() => setActiveGroup('today')}
                    />
                    <NavItem 
                        id="all" 
                        label="All Tasks" 
                        icon={MdAssignment} 
                        count={counts.all}
                        active={activeGroupId === 'all'}
                        onClick={() => setActiveGroup('all')}
                    />
                    <NavItem 
                        id="progress" 
                        label="Progress" 
                        icon={MdPieChart} 
                        count={0} // Progress usually doesn't have a task count
                        active={activeGroupId === 'progress'}
                        onClick={() => setActiveGroup('progress')}
                    />
                </div>

                <div className="space-y-1">
                    <div className="px-3">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">TAGS</span>
                    </div>
                    <div className="px-3 py-2">
                        <ColorFilter />
                    </div>
                </div>
            </div>
        </div>
    );
}