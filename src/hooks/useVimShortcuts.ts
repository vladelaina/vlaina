import { useEffect } from 'react';
import { useTaskStore } from '@/stores/useTaskStore';

/**
 * Check if the user is currently typing in an input field
 */
function isTyping(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  const tagName = activeElement.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea';
  const isEditable = activeElement.getAttribute('contenteditable') === 'true';
  
  return isInput || isEditable;
}

/**
 * VIM-style keyboard shortcuts for task navigation
 * 
 * Keys:
 * - j: Select next task
 * - k: Select previous task
 * - x: Toggle selected task done/undone
 * - Enter: Edit selected task
 * - Escape: Clear selection
 * - dd: Delete selected task
 */
export function useVimShortcuts() {
  const {
    selectedTaskId,
    selectNextTask,
    selectPrevTask,
    toggleSelectedTask,
    deleteTask,
    selectTask,
  } = useTaskStore();

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (isTyping()) return;

      // Ignore if Command/Ctrl is held (for other shortcuts like Cmd+K)
      if (e.metaKey || e.ctrlKey) return;

      const key = e.key.toLowerCase();
      const now = Date.now();

      switch (key) {
        case 'j':
          e.preventDefault();
          selectNextTask();
          break;

        case 'k':
          e.preventDefault();
          selectPrevTask();
          break;

        case 'x':
          e.preventDefault();
          toggleSelectedTask();
          break;

        case 'enter':
          if (selectedTaskId) {
            e.preventDefault();
            // Focus the task's input by triggering a click on the content
            const taskElement = document.querySelector(
              `[data-task-id="${selectedTaskId}"]`
            );
            const contentSpan = taskElement?.querySelector('[data-editable]');
            if (contentSpan instanceof HTMLElement) {
              contentSpan.click();
            }
          }
          break;

        case 'escape':
          e.preventDefault();
          selectTask(null);
          break;

        case 'd':
          // Double-d to delete (dd)
          if (lastKey === 'd' && now - lastKeyTime < 300 && selectedTaskId) {
            e.preventDefault();
            deleteTask(selectedTaskId);
            selectTask(null);
          }
          break;

        case 'g':
          // gg to go to first task
          if (lastKey === 'g' && now - lastKeyTime < 300) {
            e.preventDefault();
            const tasks = useTaskStore.getState().tasks;
            if (tasks.length > 0) {
              selectTask(tasks[0].id);
            }
          }
          break;
      }

      lastKey = key;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedTaskId,
    selectNextTask,
    selectPrevTask,
    toggleSelectedTask,
    deleteTask,
    selectTask,
  ]);
}
