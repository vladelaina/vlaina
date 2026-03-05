import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';

interface ChatShortcutsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatShortcutsDialog({ isOpen, onOpenChange }: ChatShortcutsDialogProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const deleteKey = isMac ? '⌫' : 'Backspace';

  const shortcuts = [
    { action: 'Open new chat', keys: ['Ctrl', 'Shift', 'O'] },
    { action: 'Open temporary chat (toggle if empty)', keys: ['Ctrl', 'Shift', 'J'] },
    { action: 'Focus chat input', keys: ['Shift', 'Esc'] },
    { action: 'Previous chat', keys: ['Ctrl', 'Shift', 'Tab'] },
    { action: 'Next chat', keys: ['Ctrl', 'Tab'] },
    { action: 'Copy last code block', keys: ['Ctrl', 'Shift', ';'] },
    { action: 'Copy last response', keys: ['Ctrl', 'Shift', 'C'] },
    { action: 'Previous message', keys: ['Shift', '↑'] },
    { action: 'Next message', keys: ['Shift', '↓'] },
    { action: 'Delete chat', keys: ['Ctrl', 'Shift', deleteKey] },
    { action: 'Show shortcuts', keys: ['Ctrl', '/'] },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#1E1E1E] border-gray-200 dark:border-zinc-800 shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of available keyboard shortcuts for NekoTick AI Chat.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-4 pb-6 space-y-1">
          {shortcuts.map((shortcut, index) => (
            <div 
                key={index} 
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
            >
              <span className="text-[14px] text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 font-medium transition-colors">
                {shortcut.action}
              </span>
              <ShortcutKeys keys={shortcut.keys} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
