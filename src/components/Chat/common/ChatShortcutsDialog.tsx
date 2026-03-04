import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ChatShortcutsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatShortcutsDialog({ isOpen, onOpenChange }: ChatShortcutsDialogProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  const MODIFIER = isMac ? '⌘' : 'Ctrl';
  const SHIFT = isMac ? '⇧' : 'Shift';
  const ESC = 'Esc';
  const DELETE = isMac ? '⌫' : 'Backspace';

  const shortcuts = [
    { action: 'Open new chat', keys: [MODIFIER, SHIFT, 'O'] },
    { action: 'Open temporary chat (toggle if empty)', keys: [MODIFIER, SHIFT, 'J'] },
    { action: 'Focus chat input', keys: [SHIFT, ESC] },
    { action: 'Previous chat', keys: [MODIFIER, SHIFT, 'Tab'] },
    { action: 'Next chat', keys: [MODIFIER, 'Tab'] },
    { action: 'Copy last code block', keys: [MODIFIER, SHIFT, ';'] },
    { action: 'Copy last response', keys: [MODIFIER, SHIFT, 'C'] },
    { action: 'Previous message', keys: [SHIFT, '↑'] },
    { action: 'Next message', keys: [SHIFT, '↓'] },
    { action: 'Delete chat', keys: [MODIFIER, SHIFT, DELETE] },
    { action: 'Show shortcuts', keys: [MODIFIER, '/'] },
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
              <div className="flex items-center gap-1.5">
                {shortcut.keys.map((key, kIndex) => (
                  <kbd 
                    key={kIndex}
                    className={cn(
                        "min-w-[28px] h-7 px-2 flex items-center justify-center rounded-lg text-[13px] font-bold border-b-2 shadow-sm transition-all",
                        "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 border-b-gray-300 dark:border-b-zinc-600 active:border-b-0 active:translate-y-[1px]",
                        isMac ? "font-sans" : "font-mono"
                    )}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
