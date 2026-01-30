import React, { ReactNode } from 'react';
import { SortableDivider } from '@/components/common/TaskList';

interface TodoListSectionProps<T> {
    title?: string; // If provided, renders a Divider
    id?: string; // ID for the divider (required if title is present)
    items: T[];
    renderItem: (item: T) => ReactNode;
    isExpanded?: boolean;
    onToggleExpand?: () => void;

    // Optional Menu for the section header (e.g., "Archive All" for Completed)
    menuContent?: ReactNode;
    showMenu?: boolean;
    onMenuToggle?: () => void;
    menuRef?: React.RefObject<HTMLDivElement | null>;

    // If no items
    emptyState?: ReactNode;
}

export function TodoListSection<T>({
    title,
    id,
    items,
    renderItem,
    isExpanded = true,
    onToggleExpand = () => { },
    menuContent,
    showMenu,
    onMenuToggle,
    menuRef,
    emptyState
}: TodoListSectionProps<T>) {

    // Case 1: Simple list without divider (e.g., Incomplete tasks)
    if (!title) {
        if (items.length === 0 && emptyState) {
            return <>{emptyState}</>;
        }
        return (
            <div className="space-y-2">
                {items.map(renderItem)}
            </div>
        );
    }

    // Case 2: Section with Divider (e.g., Scheduled, Completed)
    // Only render if there are items (or we could choose to render empty sections, but current design hides them)
    if (items.length === 0) return null;

    return (
        <div className="mt-8">
            <SortableDivider
                id={id || 'divider'}
                label={title}
                count={items.length}
                expanded={isExpanded}
                onToggleExpand={onToggleExpand}
                showMenu={showMenu}
                onMenuToggle={onMenuToggle}
                menuRef={menuRef}
                menuContent={menuContent}
            />
            {isExpanded && (
                <div className={`space-y-2 mt-2 ${title === 'Completed' ? 'opacity-60' : ''}`}>
                    {items.map(renderItem)}
                </div>
            )}
        </div>
    );
}