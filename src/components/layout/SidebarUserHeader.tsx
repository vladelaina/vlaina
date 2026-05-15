import { useEffect, useRef, useState } from 'react';
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
    const headerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            const rect = headerRef.current?.getBoundingClientRect();
            if (!rect) return;

            setIsHovered(
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            );
        };

        const handleMouseLeaveWindow = () => setIsHovered(false);

        window.addEventListener('mousemove', handleMouseMove, true);
        window.addEventListener('mouseleave', handleMouseLeaveWindow);
        window.addEventListener('blur', handleMouseLeaveWindow);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('mouseleave', handleMouseLeaveWindow);
            window.removeEventListener('blur', handleMouseLeaveWindow);
        };
    }, []);

    return (
        <div
            ref={headerRef}
            className="vlaina-drag-region vlaina-sidebar-user-header group/sidebar-user-header relative flex h-10 w-full items-center px-3"
            data-hovered={isHovered ? 'true' : undefined}
        >
            <div
                className={cn(
                    'vlaina-sidebar-user-header-pill flex h-8 w-full items-center justify-between rounded-full border border-transparent bg-transparent px-1 transition-[background-color,box-shadow]',
                )}
            >
                <WorkspaceSwitcher className="h-full w-[calc(100%-5.25rem)] min-w-0 justify-start" />
                <div
                    className="vlaina-drag-region h-full min-w-12 flex-1 cursor-grab active:cursor-grabbing"
                    aria-hidden="true"
                />
                <Tooltip delayDuration={700}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label={t('common.collapseSidebar')}
                            className={cn(
                                'vlaina-sidebar-user-header-collapse pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-transparent opacity-0 transition-opacity',
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
