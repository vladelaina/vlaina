import React, { ReactNode } from 'react';
import { SortableDivider } from '@/components/common/TaskList';

interface TodoListSectionProps<T> {
    title?: string;
    id?: string;
    items: T[];
    renderItem: (item: T) => ReactNode;
    isExpanded?: boolean;
    onToggleExpand?: () => void;

    menuContent?: ReactNode;
    showMenu?: boolean;
    onMenuToggle?: () => void;
    menuRef?: React.RefObject<HTMLDivElement | null>;

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