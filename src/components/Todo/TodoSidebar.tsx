import { useMemo } from 'react';
import {
    MdCalendarToday,
    MdOutlinePieChart,
    MdOutlineAssignment,
    MdOutlineCheckCircle,
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

    const todayDate = new Date().getDate(); // 获取今天的日期数字



    const counts = useMemo(() => {
        const c = { today: 0, all: 0, completed: 0 };
        const todayKey = getTodayKey();

        tasks.forEach((t: any) => {
            if (t.completed) {
                c.completed++;
                return;
            }
            
            c.all++;

            if (t.dtstart) {
                const taskDateKey = formatDateKey(new Date(t.dtstart));
                if (taskDateKey === todayKey) c.today++;
            }
        });
        return c;
    }, [tasks]);



    const NavItem = ({ label, icon: Icon, count, onClick, active, customIcon }: any) => (
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
                {customIcon ? customIcon : <Icon className={cn("size-[18px]", active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")} />}
                <span>{label}</span>
            </div>
            {count > 0 && (
                <span className={cn(
                    "text-xs transition-colors",
                    active 
                        ? "text-zinc-900 dark:text-zinc-100" 
                        : "text-zinc-400"
                )}>
                    {count}
                </span>
            )}
        </button>
    );

    // 自定义日历图标，中间显示日期数字
    const CalendarIcon = ({ active }: { active: boolean }) => (
        <div className={cn(
            "relative size-[18px]",
            active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
        )}>
            <MdCalendarToday className="size-[18px]" />
            <span className={cn(
                "absolute text-[7px] font-bold leading-none",
                "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "mt-[1px]",
                active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
            )}>
                {todayDate}
            </span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-zinc-50/80 dark:bg-zinc-900/50 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 select-none">
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                
                <div className="space-y-0.5">
                    <NavItem 
                        id="today" 
                        label="Today" 
                        customIcon={<CalendarIcon active={activeGroupId === 'today'} />}
                        count={counts.today}
                        active={activeGroupId === 'today'}
                        onClick={() => setActiveGroup('today')}
                    />
                    <NavItem 
                        id="progress" 
                        label="Progress" 
                        icon={MdOutlinePieChart} 
                        count={0}
                        active={activeGroupId === 'progress'}
                        onClick={() => setActiveGroup('progress')}
                    />
                    <NavItem 
                        id="all" 
                        label="All Tasks" 
                        icon={MdOutlineAssignment} 
                        count={counts.all}
                        active={activeGroupId === 'all'}
                        onClick={() => setActiveGroup('all')}
                    />
                    <NavItem 
                        id="completed" 
                        label="Completed" 
                        icon={MdOutlineCheckCircle} 
                        count={counts.completed}
                        active={activeGroupId === 'completed'}
                        onClick={() => setActiveGroup('completed')}
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