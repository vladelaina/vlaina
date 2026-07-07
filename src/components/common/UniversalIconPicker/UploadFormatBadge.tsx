import { cn } from '@/lib/utils';

interface UploadFormatBadgeProps {
    isGif: boolean;
    label: string;
}

export function UploadFormatBadge({ isGif, label }: UploadFormatBadgeProps) {
    return (
        <div className="absolute bottom-3 left-3 bg-[var(--vlaina-color-overlay)] text-[var(--vlaina-color-inverse-text)] text-[var(--vlaina-font-10)] px-2 py-1 rounded-full backdrop-blur-[var(--vlaina-backdrop-blur-sm)] border border-[var(--vlaina-color-panel-border)] flex items-center gap-1.5 pointer-events-none">
            <span className="relative flex h-2 w-2">
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-[var(--vlaina-opacity-75)] animate-ping", isGif ? "bg-[var(--vlaina-color-status-success-fg)]" : "bg-[var(--vlaina-color-status-info-fg)]")}></span>
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isGif ? "bg-[var(--vlaina-color-status-success-fg)]" : "bg-[var(--vlaina-color-status-info-fg)]")}></span>
            </span>
            {label}
        </div>
    );
}
