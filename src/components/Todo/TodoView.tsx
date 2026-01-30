import { TodoPanel } from './TodoPanel';

// TodoView - Pure content component for Todo page
export function TodoView() {
    return (
        <div className="h-full w-full">
            <TodoPanel />
        </div>
    );
}