import { useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/icons';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import {
    collectUniqueTags,
    isSystemTagFilter,
    matchesSelectedTag,
    SYSTEM_TAG_TODAY,
    SYSTEM_TAG_WEEK
} from '@/lib/tags/tagUtils';
import { TagFilterList } from './tags';

export function TodoSidebar() {
    const { 
        tasks, 
        activeGroupId, 
        setActiveGroup
    } = useGroupStore();
    const { selectedTag, setSelectedTag, setHideCompleted } = useUIStore();

    const counts = useMemo(() => {
        const c = { all: 0, completed: 0 };

        tasks.forEach((t: any) => {
            if (t.completed) {
                c.completed++;
                return;
            }
            
            c.all++;
        });
        return c;
    }, [tasks]);

    const topLevelTasks = useMemo(
        () => tasks.filter(task => !task.parentId),
        [tasks]
    );

    const availableTags = useMemo(
        () => collectUniqueTags(topLevelTasks),
        [topLevelTasks]
    );
    const todayLabelTaskCount = useMemo(() => {
        return topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_TODAY)).length;
    }, [topLevelTasks]);
    const weekLabelTaskCount = useMemo(() => {
        return topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_WEEK)).length;
    }, [topLevelTasks]);
    const shouldShowTagFilters = availableTags.length > 0 || todayLabelTaskCount > 0 || weekLabelTaskCount > 0 || selectedTag !== null;

    useEffect(() => {
        if (!selectedTag || isSystemTagFilter(selectedTag)) return;
        const stillExists = availableTags.some(tag => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase());
        if (!stillExists) {
            setSelectedTag(null);
        }
    }, [availableTags, selectedTag, setSelectedTag]);



    const handleSelectGroup = (groupId: string) => {
        setSelectedTag(null);
        setActiveGroup(groupId);
    };

    const handleSelectTag = (tag: string | null) => {
        setSelectedTag(tag);
        setActiveGroup('all');
        setHideCompleted(false);
    };

    const NavItem = ({ label, iconName, count, onClick, active, customIcon }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ease-out group",
                active
                    ? "bg-[#f5f5f5] dark:bg-[#222] text-gray-800 dark:text-gray-200 font-medium" 
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

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#171717] select-none">
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
                
                <div className="flex flex-col gap-0.5">
                    <div className="flex flex-col gap-0.5">
                        <NavItem 
                            id="all" 
                            label="Tasks" 
                            iconName="sidebar.todo" 
                            count={counts.all}
                            active={activeGroupId === 'all'}
                            onClick={() => handleSelectGroup('all')}
                        />
                        <NavItem 
                            id="progress" 
                            label="Progress" 
                            iconName="sidebar.stats" 
                            count={0}
                            active={activeGroupId === 'progress'}
                            onClick={() => handleSelectGroup('progress')}
                        />
                        <NavItem 
                            id="completed" 
                            label="Completed" 
                            iconName="sidebar.completed" 
                            count={counts.completed}
                            active={activeGroupId === 'completed'}
                            onClick={() => handleSelectGroup('completed')}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-0.5">
                    <div className="px-3 py-2">
                        <ColorFilter />
                        {shouldShowTagFilters && (
                            <div className="mt-3">
                                <h3 className="px-1 py-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400 select-none">
                                    Labels
                                </h3>
                                <TagFilterList
                                    tasks={tasks}
                                    selectedTag={selectedTag}
                                    onSelectTag={handleSelectTag}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
