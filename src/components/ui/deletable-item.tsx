import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MdClose  } from 'react-icons/md';
import { DeleteIcon } from '@/components/common/DeleteIcon';

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
            {/* Main Content with Blur Effect */}
            <div className={cn(
                "w-full h-full transition-all duration-300",
                isDeleting ? "opacity-40 blur-[0.5px]" : "opacity-100"
            )}>
                {children}
            </div>

            {/* Interaction Layer */}
            {isDeleting ? (
                <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-30"
                >
                    <div className="text-red-500 transition-all active:scale-90 pointer-events-none">
                        <DeleteIcon size={24} />
                    </div>
                </div>
            ) : (
                !disabled && (
                    <button
                        onClick={handleDeleteTrigger}
                        className={cn(
                            "absolute -top-1 -right-1 z-20 p-1.5 transition-all duration-200",
                            "flex items-center justify-center",
                            "text-[var(--neko-text-tertiary)] hover:text-red-500",
                            "opacity-0 group-hover/item:opacity-100",
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