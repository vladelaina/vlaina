/**
 * KeyboardShortcuts - Help panel showing available shortcuts
 */

import { XIcon, KeyboardIcon } from '@phosphor-icons/react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['Ctrl', 'P'], description: 'Quick search notes' },
    { keys: ['Ctrl', 'N'], description: 'Create new note' },
  ]},
  { category: 'Editing', items: [
    { keys: ['Ctrl', 'S'], description: 'Save note' },
    { keys: ['Ctrl', 'B'], description: 'Bold text' },
    { keys: ['Ctrl', 'I'], description: 'Italic text' },
    { keys: ['Ctrl', 'Z'], description: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
  ]},
  { category: 'View', items: [
    { keys: ['Ctrl', '?'], description: 'Show keyboard shortcuts' },
  ]},
];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <KeyboardIcon className="size-5 text-zinc-500" weight="duotone" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Keyboard Shortcuts
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
          >
            <XIcon className="size-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-auto space-y-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                            {key}
                          </kbd>
                          {keyIndex < item.keys.length - 1 && (
                            <span className="text-zinc-400 mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
