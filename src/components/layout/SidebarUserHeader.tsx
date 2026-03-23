import { Icon } from '@/components/ui/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarUserHeaderProps {
    onOpenSettings?: () => void;
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ onOpenSettings, toggleSidebar }: SidebarUserHeaderProps) {
    const appViewMode = useUIStore(s => s.appViewMode);
    const notesSidebarView = useUIStore(s => s.notesSidebarView);
    const setNotesSidebarView = useUIStore(s => s.setNotesSidebarView);
    const setAppViewMode = useUIStore(s => s.setAppViewMode);

    const handleToggleNotesSidebarView = () => {
        setNotesSidebarView(notesSidebarView === 'workspace' ? 'outline' : 'workspace');
    };

    const switchTarget = appViewMode === 'chat'
        ? { mode: 'notes' as const, icon: 'file.text', label: 'Switch to Notes' }
        : { mode: 'chat' as const, icon: 'common.sparkle', label: 'Switch to Chat' };

    return (
        <div
            className="group/header flex items-center px-3 h-10 w-full gap-1"
            data-tauri-drag-region
        >
            <WorkspaceSwitcher onOpenSettings={onOpenSettings} />

            <div className="flex-1 h-full" data-tauri-drag-region />

            <div className="flex max-w-0 items-center gap-1 overflow-hidden opacity-0 pointer-events-none transition-[max-width,opacity] duration-150 group-hover/header:max-w-[220px] group-hover/header:opacity-100 group-hover/header:pointer-events-auto group-focus-within/header:max-w-[220px] group-focus-within/header:opacity-100 group-focus-within/header:pointer-events-auto">
                <Tooltip delayDuration={1000}>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setAppViewMode(switchTarget.mode)}
                            className={cn(
                                "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                                "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                                iconButtonStyles
                            )}
                            aria-label={switchTarget.label}
                        >
                            <Icon name={switchTarget.icon} size="md" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={2}>
                        <span className="text-xs">{switchTarget.label}</span>
                    </TooltipContent>
                </Tooltip>

                {appViewMode === 'notes' && (
                    <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleToggleNotesSidebarView}
                                className={cn(
                                    "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                                    "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                                    iconButtonStyles
                                )}
                            >
                                <Icon
                                    name={notesSidebarView === 'workspace' ? 'common.list' : 'file.folderOpen'}
                                    size="md"
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={2}>
                            <span className="text-xs">
                                {notesSidebarView === 'workspace' ? 'Switch to Outline' : 'Switch to Files'}
                            </span>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            <button
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className={cn(
                    "group flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
                    "hover:bg-[#f5f5f5] dark:hover:bg-white/10",
                    iconButtonStyles
                )}
            >
                <>
                    <Icon name="nav.sidebarDock" size="md" className="group-hover:hidden" />
                    <Icon name="nav.collapse" size="md" className="hidden group-hover:block" />
                </>
            </button>
        </div>
    );
}
