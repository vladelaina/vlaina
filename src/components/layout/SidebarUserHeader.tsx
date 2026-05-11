import { Icon } from '@/components/ui/icons';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface SidebarUserHeaderProps {
    toggleSidebar: () => void;
}

export function SidebarUserHeader({ toggleSidebar }: SidebarUserHeaderProps) {
    const { t } = useI18n();

    return (
        <div
            className="vlaina-drag-region group/sidebar-user-header relative flex h-10 w-full items-center px-3"
        >
            <div
                className={cn(
                    'vlaina-no-drag flex h-8 w-full items-center justify-between rounded-full border border-transparent bg-transparent px-1 transition-[background-color,box-shadow]',
                    'group-hover/sidebar-user-header:bg-white group-hover/sidebar-user-header:shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]',
                    'group-focus-within/sidebar-user-header:bg-white group-focus-within/sidebar-user-header:shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]'
                )}
            >
                <WorkspaceSwitcher className="h-full w-auto min-w-0 flex-1 justify-start" />
                <Tooltip delayDuration={700}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label={t('common.collapseSidebar')}
                            className={cn(
                                'pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-transparent opacity-0 transition-opacity',
                                'group-hover/sidebar-user-header:pointer-events-auto group-hover/sidebar-user-header:opacity-100',
                                'group-focus-within/sidebar-user-header:pointer-events-auto group-focus-within/sidebar-user-header:opacity-100',
                                iconButtonStyles
                            )}
                        >
                            <Icon name="nav.collapse" size="md" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        sideOffset={6}
                        showArrow={false}
                        className={cn(
                            'flex items-center gap-1.5 rounded-[18px] px-3 py-2 text-xs text-[var(--chat-sidebar-text)]',
                            chatComposerPillSurfaceClass
                        )}
                    >
                        <ShortcutKeys
                            keys={['Ctrl', '\\']}
                            keyClassName="rounded-md bg-[var(--chat-sidebar-row-hover)] text-[var(--chat-sidebar-text)]"
                        />
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
