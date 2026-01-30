
import { MdKeyboardDoubleArrowRight, MdMenu } from 'react-icons/md';
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
                    <MdKeyboardDoubleArrowRight className="size-[18px]" />
                ) : (
                    <>
                        <MdMenu className="size-[18px] group-hover:hidden" />
                        <MdKeyboardDoubleArrowRight className="size-[18px] hidden group-hover:block" />
                    </>
                )}
            </button>
        </div>
    );
}
