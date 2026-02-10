
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';

interface SidebarExpandButtonProps {
    onClick: () => void;
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
                {isPeeking ? (
                    <Icon size="md" name="nav.expand" />
                ) : (
                    <>
                        <Icon size="md" name="common.menu" className=" group-hover:hidden" />
                        <Icon size="md" name="nav.expand" className=" hidden group-hover:block" />
                    </>
                )}
            </button>
        </div>
    );
}