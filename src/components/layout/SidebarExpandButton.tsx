import React from 'react';
import { ChevronsRight, Menu } from 'lucide-react';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarExpandButtonProps {
    onClick: () => void;
    /** If true, shows ChevronsRight immediately without hover effect (for peeking state) */
    isPeeking?: boolean;
    className?: string;
    title?: string;
}

export function SidebarExpandButton({
    onClick,
    isPeeking = false,
    className,
    title = "Expand Sidebar"
}: SidebarExpandButtonProps) {
    return (
        <div className={cn("flex items-center z-20", className)}>
            <button
                onClick={onClick}
                className={cn(
                    "flex items-center justify-center w-9 h-full",
                    iconButtonStyles,
                    "group"
                )}
                title={title}
            >
                {/* When peeking: show ChevronsRight immediately. 
                    Otherwise: Show Menu icon, swapping to ChevronsRight on hover. */}
                {isPeeking ? (
                    <ChevronsRight className="size-4" />
                ) : (
                    <>
                        <Menu className="size-4 group-hover:hidden" />
                        <ChevronsRight className="size-4 hidden group-hover:block" />
                    </>
                )}
            </button>
        </div>
    );
}
