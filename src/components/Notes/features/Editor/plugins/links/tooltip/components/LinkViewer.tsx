import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkViewerProps {
    href: string;
    displayUrl: string;
    isAutolink: boolean;
    showCopied: boolean;
    onCopy: () => void;
    onEdit: () => void;
    onUnlink: () => void;
    onRemove: () => void;
}

export const LinkViewer = ({
    href,
    displayUrl,
    isAutolink,
    showCopied,
    onCopy,
    onEdit,
    onUnlink,
    onRemove
}: LinkViewerProps) => {

    const handleOpen = async () => {
        await openExternalHref(href);
    };

    const actionButtonClass = 'toolbar-btn link-tooltip-action-btn';

    return (
        <div
            className={cn(
                'floating-toolbar-inner link-tooltip-viewer !rounded-[26px] animate-in fade-in duration-100',
                chatComposerPillSurfaceClass
            )}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={handleOpen}
                            className="toolbar-btn link-tooltip-open-btn group max-w-[200px]"
                        >
                            <span className="flex items-center justify-center size-5 rounded text-[var(--vlaina-text-tertiary)] group-hover:text-[var(--vlaina-accent)] transition-colors">
                                <Icon size="md" name="nav.external" />
                            </span>
                            <span className="truncate text-[13px] font-medium text-[var(--vlaina-text-tertiary)] group-hover:text-[var(--vlaina-text-primary)] transition-colors">
                                {displayUrl}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{href}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="toolbar-divider" />

            <div className="flex items-center gap-0.5">
                <button onClick={onCopy} className={actionButtonClass}>
                    {showCopied
                        ? <Icon size="md" name="common.check" className="text-[var(--vlaina-accent)] scale-110" />
                        : <Icon size="md" name="common.copy" />}
                </button>

                <button onClick={onEdit} className={actionButtonClass}>
                    <Icon size="md" name="common.compose" />
                </button>
            </div>

            <div className="toolbar-divider" />

            <div className="flex items-center gap-0.5">
                {!isAutolink && (
                    <button onClick={onUnlink} className={actionButtonClass}>
                        <Icon size="md" name="common.blocked" />
                    </button>
                )}

                <button
                    onClick={onRemove}
                    className={cn(actionButtonClass, 'hover:!text-red-500')}
                >
                    <Icon size="md" name="common.delete" />
                </button>
            </div>
        </div>
    );
};
