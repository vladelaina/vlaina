import { ToggleIcon } from '@/components/common/ToggleIcon';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
    title: string;
    expanded: boolean;
    onToggle: () => void;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export function CollapsibleSection({
    title,
    expanded,
    onToggle,
    actions,
    children,
    className,
}: CollapsibleSectionProps) {
    const handleHeaderClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
            onToggle();
        }
    };

    return (
        <div className={className}>
            {/* Header */}
            <div className="px-2 py-1 mb-0.5">
                <div
                    onClick={handleHeaderClick}
                    className="group flex items-center justify-between px-2 py-1 rounded-[4px] cursor-pointer"
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[var(--neko-text-secondary)] group-hover:text-[var(--neko-text-primary)] tracking-wider transition-colors">
                            {title}
                        </span>
                        <ToggleIcon expanded={expanded} size={18} className="text-[var(--neko-text-tertiary)] group-hover:text-[var(--neko-text-secondary)] transition-colors" />
                    </div>
                    {actions && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {actions}
                        </div>
                    )}
                </div>
            </div>

            {/* Collapsible content */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}