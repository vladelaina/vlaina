import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  id: string;
  name: string;
  keys: string[];
  editable: boolean;
}

const defaultShortcuts: Shortcut[] = [
  {
    id: 'toggle-drawer',
    name: '打开/关闭侧边栏',
    keys: ['Ctrl', 'B'],
    editable: true,
  },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(defaultShortcuts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setRecordingKeys([]);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // ESC to close dialog
    if (e.key === 'Escape') {
      e.preventDefault();
      if (editingId) {
        // Cancel editing
        setEditingId(null);
        setRecordingKeys([]);
      } else {
        // Close dialog
        onClose();
      }
      return;
    }
    
    if (!editingId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      keys.push(e.key.toUpperCase());
    }
    
    if (keys.length > 1) {
      setRecordingKeys(keys);
      
      setTimeout(() => {
        setShortcuts(prev => prev.map(s => 
          s.id === editingId ? { ...s, keys } : s
        ));
        setEditingId(null);
        setRecordingKeys([]);
      }, 300);
    }
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    setRecordingKeys([]);
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
            onKeyDown={handleKeyDown}
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
                    {shortcut.name}
                  </span>
                  
                  {editingId === shortcut.id ? (
                    <div className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {recordingKeys.length > 0 ? recordingKeys.join(' + ') : '...'}
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(shortcut.id)}
                      className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {shortcut.keys.join(' + ')}
                    </button>
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
