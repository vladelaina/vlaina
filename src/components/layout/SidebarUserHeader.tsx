import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { isMacOS } from '@/lib/desktop/platform';
import { useUIStore } from '@/stores/uiSlice';

const WorkspaceSwitcher = lazy(async () => {
    const mod = await import('./WorkspaceSwitcher');
    return { default: mod.WorkspaceSwitcher };
});

interface SidebarUserHeaderProps {
    toggleSidebar: () => void;
}

function WorkspaceSwitcherFallback() {
    return (
        <div className="app-no-drag flex h-full w-[var(--vlaina-width-minus-titlebar-actions)] min-w-0 items-center justify-start">
            <span className="relative flex size-[var(--vlaina-size-26px)] shrink-0 overflow-hidden rounded-[var(--vlaina-radius-8px)]">
                <img src={`${import.meta.env.BASE_URL}logo.png?v=20260327`} alt="vlaina" className="h-full w-full object-cover shadow-[var(--vlaina-shadow-sm)]" />
            </span>
        </div>
    );
}

export function SidebarUserHeader({ toggleSidebar }: SidebarUserHeaderProps) {
    const { t } = useI18n();
    const headerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const devPlatformPreview = useUIStore((state) => state.devPlatformPreview);
    const shouldReserveMacTrafficLightSpace = isMacOS(devPlatformPreview);

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
        return () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('mouseleave', handleMouseLeaveWindow);
        };
    }, []);

    return (
        <div
            ref={headerRef}
            className={cn(
                'app-drag-region sidebar-user-header group/sidebar-user-header relative flex h-10 w-full items-center pr-3',
                shouldReserveMacTrafficLightSpace ? 'pl-[var(--vlaina-space-76px)]' : 'pl-3'
            )}
            data-hovered={isHovered ? 'true' : undefined}
        >
            <div
                className={cn(
                    'sidebar-user-header-pill flex h-8 w-full items-center justify-between rounded-full border border-transparent bg-transparent px-1 transition-[background-color,box-shadow]',
                )}
            >
                <Suspense fallback={<WorkspaceSwitcherFallback />}>
                    <WorkspaceSwitcher className="h-full w-[var(--vlaina-width-minus-titlebar-actions)] min-w-0 justify-start" />
                </Suspense>
                <div
                    className="app-drag-region h-full min-w-12 flex-1 cursor-grab active:cursor-grabbing"
                    aria-hidden="true"
                />
                <Tooltip delayDuration={700}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label={t('common.collapseSidebar')}
                            className={cn(
                                'sidebar-user-header-collapse pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-transparent opacity-[var(--vlaina-opacity-0)] transition-[color,opacity]',
                                iconButtonStyles,
                                'hover:text-[var(--vlaina-accent)]'
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
                            'flex items-center gap-1.5 rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
                            chatComposerPillSurfaceClass
                        )}
                    >
                        <ShortcutKeys
                            keys={['Ctrl', '\\']}
                            keyClassName="rounded-md bg-[var(--vlaina-sidebar-chat-row-hover)] text-[var(--vlaina-sidebar-chat-text)]"
                        />
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
