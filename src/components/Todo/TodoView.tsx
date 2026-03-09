import { useCallback, useState } from 'react';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';
import { TodoPanel } from './TodoPanel';

export function TodoView() {
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);

    useModuleShortcutsDialog({ onToggle: toggleShortcutsDialog });

    return (
        <>
            <div className="h-full w-full">
                <TodoPanel />
            </div>
            <ModuleShortcutsDialog module="todo" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
        </>
    );
}
