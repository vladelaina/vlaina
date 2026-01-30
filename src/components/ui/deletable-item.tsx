import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MdClose, MdDelete } from 'react-icons/md';

interface DeletableItemProps {
    id: string;
    children: React.ReactNode;
    onDelete: (id: string) => void;
    className?: string; // Wrapper class
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

        // If currently confirming delete, clicking again performs the delete
        if (isDeleting) {
            e.stopPropagation();
            onDelete(id);
            setIsDeleting(false); // Reset state just in case (though item usually disappears)
        }
        // Otherwise, assume parent handles selection unless we block it
        // But here we need to intercept the click if we want to enter delete mode via click?
        // Actually, the previous design used a small X button to ENTER delete mode.
        // Let's stick to that pattern: X button enters mode, then whole item becomes confirm button.
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
            {/* Main Content with Blur Effect */}
            <div className={cn(
                "w-full h-full transition-all duration-300",
                isDeleting ? "opacity-40 blur-[0.5px]" : "opacity-100"
            )}>
                {children}
            </div>

            {/* Interaction Layer */}
            {isDeleting ? (
                // Confirmation State: Large Centered Trash Icon
                <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-30"
                // Click is handled by parent wrapper's onClick due to bubbling, 
                // or we can explicitly handle it here to be safe.
                // But wrapper has onClick={handleClick} which handles the logic.
                >
                    <div className="text-red-500 transition-all active:scale-90 pointer-events-none">
                        <MdDelete size={24} />
                    </div>
                </div>
            ) : (
                // Idle State: Ghost X Button (top-right)
                !disabled && (
                    <button
                        onClick={handleDeleteTrigger}
                        className={cn(
                            "absolute -top-1 -right-1 z-20 p-1.5 transition-all duration-200",
                            "flex items-center justify-center",
                            "text-[var(--neko-text-tertiary)] hover:text-red-500",
                            "opacity-0 group-hover/item:opacity-100", // Show on hover
                            "scale-90 hover:scale-100"
                        )}
                    >
                        <MdClose size={18} />
                    </button>
                )
            )}
        </div>
    );
}
