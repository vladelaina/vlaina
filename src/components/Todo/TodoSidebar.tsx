import { useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/icons';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUIStore } from '@/stores/uiSlice';
import {
    isSystemTagFilter,
    matchesSelectedTag,
    matchesSelectedTagForProgressItem,
    normalizeTags,
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
    const { items: progressItems } = useProgressStore();
    const { selectedTag, setSelectedTag } = useUIStore();

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
        () => {
            const deduped = new Map<string, string>();
            const addTag = (tag: string) => {
                const key = tag.toLocaleLowerCase();
                if (!deduped.has(key)) {
                    deduped.set(key, tag);
                }
            };

            topLevelTasks.forEach(task => {
                normalizeTags(task.tags).forEach(addTag);
            });
            progressItems.forEach(item => {
                normalizeTags(item.tags).forEach(addTag);
            });

            return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b));
        },
        [topLevelTasks, progressItems]
    );
    const todayLabelTaskCount = useMemo(() => {
        const taskCount = topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_TODAY)).length;
        const progressCount = progressItems.filter(item => matchesSelectedTagForProgressItem(item, SYSTEM_TAG_TODAY)).length;
        return taskCount + progressCount;
    }, [topLevelTasks, progressItems]);
    const weekLabelTaskCount = useMemo(() => {
        const taskCount = topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_WEEK)).length;
        const progressCount = progressItems.filter(item => matchesSelectedTagForProgressItem(item, SYSTEM_TAG_WEEK)).length;
        return taskCount + progressCount;
    }, [topLevelTasks, progressItems]);
    const shouldShowTagFilters = availableTags.length > 0 || todayLabelTaskCount > 0 || weekLabelTaskCount > 0 || selectedTag !== null;

    useEffect(() => {
        if (!selectedTag || isSystemTagFilter(selectedTag)) return;
        const stillExists = availableTags.some(tag => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase());
        if (!stillExists) {
            setSelectedTag(null);
        }
    }, [availableTags, selectedTag, setSelectedTag]);



    const handleSelectGroup = (groupId: string) => {
        setActiveGroup(groupId);
    };

    const handleSelectTag = (tag: string | null) => {
        setSelectedTag(tag);
    };

    const NavItem = ({ label, iconName, count, onClick, active, customIcon }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ease-out group",
                active
                    ? "bg-[var(--todo-sidebar-row-active)] text-[var(--todo-sidebar-text)] font-medium"
                    : "text-[var(--todo-sidebar-text-muted)] hover:bg-[var(--todo-sidebar-row-hover)]"
            )}
        >
            <div className="flex items-center gap-3">
                {customIcon ? customIcon : <Icon size="md" name={iconName} className={cn("", active ? "text-[var(--todo-sidebar-icon-active)]" : "text-[var(--todo-sidebar-icon)]")} />}
                <span>{label}</span>
            </div>
            {count > 0 && (
                <span className={cn(
                    "text-xs transition-colors",
                    active
                        ? "text-[var(--todo-sidebar-count-active)]"
                        : "text-[var(--todo-sidebar-count)]"
                )}>
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-[var(--todo-sidebar-surface)] select-none">
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
                            <div className="mt-2">
                                <TagFilterList
                                    tasks={tasks}
                                    availableTags={availableTags}
                                    todayCount={todayLabelTaskCount}
                                    weekCount={weekLabelTaskCount}
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
