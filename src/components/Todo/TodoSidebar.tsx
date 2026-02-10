import { useMemo } from 'react';
import { Icon } from '@/components/ui/icons';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
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



    const NavItem = ({ label, iconName, count, onClick, active, customIcon }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ease-out group",
                active
                    ? "bg-[#F4F4F5] dark:bg-[#222] text-gray-800 dark:text-gray-200 font-medium" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-[#F9F9FA] dark:hover:bg-[#1E1E1E]"
            )}
        >
            <div className="flex items-center gap-3">
                {customIcon ? customIcon : <Icon size="md" name={iconName} className={cn("", active ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500")} />}
                <span>{label}</span>
            </div>
            {count > 0 && (
                <span className={cn(
                    "text-xs transition-colors",
                    active 
                        ? "text-gray-800 dark:text-gray-200" 
                        : "text-gray-400"
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
            active ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
        )}>
            <Icon size="md" name="sidebar.calendar" />
            <span className={cn(
                "absolute text-[7px] font-bold leading-none",
                "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "mt-[1px]",
                active ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
            )}>
                {todayDate}
            </span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#171717] select-none">
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
                
                <div className="space-y-[2px]">
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
                        iconName="sidebar.stats" 
                        count={0}
                        active={activeGroupId === 'progress'}
                        onClick={() => setActiveGroup('progress')}
                    />
                    <NavItem 
                        id="all" 
                        label="All Tasks" 
                        iconName="sidebar.todo" 
                        count={counts.all}
                        active={activeGroupId === 'all'}
                        onClick={() => setActiveGroup('all')}
                    />
                    <NavItem 
                        id="completed" 
                        label="Completed" 
                        iconName="sidebar.completed" 
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