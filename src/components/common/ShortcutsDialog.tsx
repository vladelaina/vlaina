import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose } from 'react-icons/md';
import { useShortcutEditor } from '@/components/Settings/hooks/useShortcutEditor';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const {
    shortcuts,
    editingId,
    recordingKeys,
    startEditing,
    clearShortcut,
    handleKeyDown,
    resetState,
  } = useShortcutEditor();

  useEffect(() => {
    if (open) resetState();
  }, [open, resetState]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (editingId) {
        resetState();
      } else {
        onClose();
      }
      return;
    }
    handleKeyDown(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            tabIndex={-1}
            className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[400px] max-w-[90vw] p-4"
          >
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {shortcut.description}
                  </span>
                  
                  {editingId === shortcut.id ? (
                    <div className="relative w-28 shortcut-input-container">
                      <input
                        type="text"
                        value={recordingKeys.length > 0 ? recordingKeys.join('+') : ''}
                        placeholder={shortcut.keys.length > 0 ? shortcut.keys.join('+') : ''}
                        readOnly
                        autoFocus
                        className="w-full pl-3 pr-7 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded text-xs text-center text-zinc-600 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-transparent"
                      />
                      {(recordingKeys.length > 0 || shortcut.keys.length > 0) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearShortcut(shortcut.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center bg-zinc-200 dark:bg-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-500 rounded-full transition-colors"
                        >
                          <MdClose className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-300" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative group w-28">
                      <button
                        onClick={() => startEditing(shortcut.id)}
                        className="w-full pl-3 pr-7 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded text-xs text-center text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
                      >
                        {shortcut.keys.length > 0 ? shortcut.keys.join('+') : 'Set shortcut'}
                      </button>
                      {shortcut.keys.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearShortcut(shortcut.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center bg-zinc-200 dark:bg-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-500 rounded-full"
                        >
                          <MdClose className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-300" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
