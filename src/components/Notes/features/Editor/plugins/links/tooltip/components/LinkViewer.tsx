import { Icon } from '@/components/ui/icons';
import { IconButton } from '@/components/ui/icon-button';
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
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(href);
        } catch (err) {
            console.warn('[LinkTooltip] Failed to open URL:', err);
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            className="flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 gap-1 animate-in fade-in zoom-in-95 duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={handleOpen}
                            className="group flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors max-w-[200px]"
                        >
                            <div className="flex items-center justify-center size-5 rounded text-gray-400 group-hover:text-blue-500 transition-colors">
                                <Icon size="md" name="nav.external" />
                            </div>
                            <span className="truncate text-[13px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                {displayUrl}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{href}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                <IconButton
                    onClick={onCopy}
                    icon={showCopied ? <Icon size="md" name="common.check" className=" text-green-500 scale-110" /> : <Icon name="common.copy" />}
                />

                <IconButton
                    onClick={onEdit}
                    icon={<Icon size="md" name="common.compose" />}
                />
            </div>

            <div className="w-[1px] h-[18px] bg-gray-200 dark:bg-zinc-700 mx-1" />

            <div className="flex items-center gap-0.5">
                {!isAutolink && (
                    <IconButton
                        onClick={onUnlink}
                        icon={<Icon size="md" name="common.blocked" />}
                    />
                )}

                <IconButton
                    onClick={onRemove}
                    icon={<Icon size="md" name="common.delete" />}
                    className="hover:text-red-500"
                />
            </div>
        </div>
    );
};
