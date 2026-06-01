import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';

interface DeletableItemProps {
    id: string;
    children: React.ReactNode;
    onDelete: (id: string) => void;
    className?: string;
    disabled?: boolean;
}

export function DeletableItem({
    id,
    children,
    onDelete,
    className,
    disabled = false
}: DeletableItemProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        if (disabled) return;

        if (isDeleting) {
            e.stopPropagation();
            onDelete(id);
            setIsDeleting(false);
        }
    };

    const handleDeleteTrigger = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    const handleMouseLeave = () => {
        if (isDeleting) {
            setIsDeleting(false);
        }
    };

    return (
        <div
            className={cn("relative group/item", className)}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <div className={cn(
                "w-full h-full transition-all duration-[var(--vlaina-duration-300)]",
                isDeleting ? "opacity-[var(--vlaina-opacity-40)] blur-[var(--vlaina-blur-05px)]" : "opacity-[var(--vlaina-opacity-100)]"
            )}>
                {children}
            </div>

            {isDeleting ? (
                <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-[var(--vlaina-z-30)]"
                >
                    <div className="text-[var(--vlaina-color-status-danger-fg)] transition-all active:scale-[var(--vlaina-scale-90)] pointer-events-none">
                        <Icon name="common.delete" size="lg" />
                    </div>
                </div>
            ) : (
                !disabled && (
                    <button
                        onClick={handleDeleteTrigger}
                        className={cn(
                            "absolute -top-1 -right-1 z-[var(--vlaina-z-20)] p-1.5 transition-all duration-[var(--vlaina-duration-200)]",
                            "flex items-center justify-center",
                            "text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-color-status-danger-fg)]",
                            "opacity-[var(--vlaina-opacity-0)] group-hover/item:opacity-[var(--vlaina-opacity-100)]",
                            "scale-[var(--vlaina-scale-90)] hover:scale-[var(--vlaina-scale-100)]"
                        )}
                    >
                        <Icon name="common.close" size="md" />
                    </button>
                )
            )}
        </div>
    );
}
