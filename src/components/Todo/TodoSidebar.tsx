import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Inbox,
    Calendar,
    PieChart,
    ClipboardList,
    Plus,
    MoreHorizontal,
    Trash2,
    Folder,
    ChevronRight,
    ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ColorFilter } from '@/components/common/ColorFilter';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { AppIcon } from '@/components/common/AppIcon';
import { IconSelector } from '@/components/common/IconSelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTodayKey, formatDateKey } from '@/lib/date';
import { useGlobalIconUpload } from '@/components/common/UniversalIconPicker/hooks/useGlobalIconUpload';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';

export function TodoSidebar() {
    const { 
        groups, 
        tasks, 
        activeGroupId, 
        setActiveGroup, 
        addGroup, 
        updateGroup, 
        deleteGroup 
    } = useGroupStore();

    const [isMyListsExpanded, setIsMyListsExpanded] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    
    const createInputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    const { customIcons, onUploadFile, onDeleteCustomIcon } = useGlobalIconUpload();
    const imageLoader = async (src: string) => {
        if (!src.startsWith('img:')) return src;
        return await loadImageAsBlob(src.substring(4));
    };

    // Calculate counts
    const counts = useMemo(() => {
        const c = { inbox: 0, today: 0, all: 0, groups: {} as Record<string, number> };
        const todayKey = getTodayKey();

        tasks.forEach(t => {
            if (t.completed) return;
            
            c.all++;
            
            if (t.groupId === DEFAULT_GROUP_ID) c.inbox++;
            else if (t.groupId) {
                c.groups[t.groupId] = (c.groups[t.groupId] || 0) + 1;
            }

            if (t.startDate) {
                const taskDateKey = formatDateKey(new Date(t.startDate));
                if (taskDateKey === todayKey) c.today++;
            }
        });
        return c;
    }, [tasks]);

    // Handlers
    const handleCreate = () => {
        if (newGroupName.trim()) {
            addGroup(newGroupName.trim());
            setNewGroupName('');
            setIsCreating(false);
        } else {
            setIsCreating(false);
        }
    };

    const handleUpdate = (id: string) => {
        if (editName.trim()) {
            const group = groups.find(g => g.id === id);
            updateGroup(id, editName.trim(), group?.icon);
            setEditingGroupId(null);
        }
    };

    const handleIconChange = (id: string, icon: string | undefined) => {
        const group = groups.find(g => g.id === id);
        if (group) {
            updateGroup(id, group.name, icon);
        }
    };

    // Auto-focus
    useEffect(() => {
        if (isCreating && createInputRef.current) createInputRef.current.focus();
    }, [isCreating]);

    useEffect(() => {
        if (editingGroupId && editInputRef.current) editInputRef.current.focus();
    }, [editingGroupId]);

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
                <Icon className={cn("size-4.5", active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")} />
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
                
                {/* Section 1: Smart Lists */}
                <div className="space-y-0.5">
                    <NavItem 
                        id={DEFAULT_GROUP_ID} 
                        label="Inbox" 
                        icon={Inbox} 
                        count={counts.inbox}
                        active={activeGroupId === DEFAULT_GROUP_ID}
                        onClick={() => setActiveGroup(DEFAULT_GROUP_ID)}
                    />
                    <NavItem 
                        id="today" 
                        label="Today" 
                        icon={Calendar} 
                        count={counts.today}
                        active={activeGroupId === 'today'}
                        onClick={() => setActiveGroup('today')}
                    />
                    <NavItem 
                        id="all" 
                        label="All Tasks" 
                        icon={ClipboardList} 
                        count={counts.all}
                        active={activeGroupId === 'all'}
                        onClick={() => setActiveGroup('all')}
                    />
                    <NavItem 
                        id="progress" 
                        label="Progress" 
                        icon={PieChart} 
                        count={0} // Progress usually doesn't have a task count
                        active={activeGroupId === 'progress'}
                        onClick={() => setActiveGroup('progress')}
                    />
                </div>

                {/* Section 2: My Lists */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between px-3 group/header">
                        <button 
                            onClick={() => setIsMyListsExpanded(!isMyListsExpanded)}
                            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors uppercase tracking-wider"
                        >
                            <span className="w-4 flex justify-center">
                                {isMyListsExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                            </span>
                            My Lists
                        </button>
                        <button 
                            onClick={() => { setIsMyListsExpanded(true); setIsCreating(true); }}
                            className="opacity-0 group-hover/header:opacity-100 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-400"
                        >
                            <Plus className="size-3.5" />
                        </button>
                    </div>

                    <AnimatePresence initial={false}>
                        {isMyListsExpanded && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-0.5 overflow-hidden"
                            >
                                {groups.filter(g => g.id !== DEFAULT_GROUP_ID).map(group => {
                                    const isActive = activeGroupId === group.id;
                                    const isEditing = editingGroupId === group.id;
                                    const count = counts.groups[group.id] || 0;

                                    if (isEditing) {
                                        return (
                                            <div key={group.id} className="flex items-center gap-2 px-3 py-1.5 mx-2 bg-white dark:bg-zinc-800 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-700">
                                                <div className="shrink-0" onPointerDown={e => e.stopPropagation()}>
                                                    <IconSelector
                                                        value={group.icon}
                                                        onChange={(icon) => handleIconChange(group.id, icon)}
                                                        compact
                                                        hideColorPicker={true}
                                                        customIcons={customIcons}
                                                        onUploadFile={onUploadFile}
                                                        onDeleteCustomIcon={onDeleteCustomIcon}
                                                        imageLoader={imageLoader}
                                                        trigger={
                                                            <button className="flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                                                                <AppIcon icon={group.icon || 'icon:Folder:default'} size={14} className="text-zinc-500" />
                                                            </button>
                                                        }
                                                    />
                                                </div>
                                                <input
                                                    ref={editInputRef}
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleUpdate(group.id);
                                                        if (e.key === 'Escape') setEditingGroupId(null);
                                                    }}
                                                    onBlur={() => handleUpdate(group.id)}
                                                    className="flex-1 bg-transparent text-sm outline-none min-w-0 text-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={group.id} className="group/item relative">
                                            <button
                                                onClick={() => setActiveGroup(group.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-colors duration-200",
                                                    isActive
                                                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium" 
                                                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <AppIcon 
                                                        icon={group.icon || 'icon:Folder:default'} 
                                                        size={18} 
                                                        className={cn(isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")} 
                                                    />
                                                    <span className="truncate">{group.name}</span>
                                                </div>
                                                {count > 0 && (
                                                    <span className="text-xs text-zinc-400 group-hover/item:opacity-0 transition-opacity">
                                                        {count}
                                                    </span>
                                                )}
                                            </button>

                                            {/* Context Menu Trigger */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button 
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={cn(
                                                            "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all",
                                                            "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                                        )}
                                                    >
                                                        <MoreHorizontal className="size-3.5" />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-32 p-1" align="end">
                                                    <button
                                                        onClick={() => {
                                                            setEditingGroupId(group.id);
                                                            setEditName(group.name);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-left"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => deleteGroup(group.id)}
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-left"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                        Delete
                                                    </button>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    );
                                })}

                                {isCreating && (
                                    <div className="flex items-center gap-2 px-3 py-2 mx-2">
                                        <div className="w-5 flex justify-center text-zinc-400"><Folder className="size-4" /></div>
                                        <input
                                            ref={createInputRef}
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleCreate();
                                                if (e.key === 'Escape') setIsCreating(false);
                                            }}
                                            onBlur={handleCreate}
                                            placeholder="Name..."
                                            className="flex-1 bg-transparent text-sm outline-none min-w-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Section 3: Tags */}
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
