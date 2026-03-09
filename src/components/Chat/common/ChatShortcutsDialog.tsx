import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';

interface ChatShortcutsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatShortcutsDialog({ isOpen, onOpenChange }: ChatShortcutsDialogProps) {
  return (
    <ModuleShortcutsDialog module="chat" open={isOpen} onOpenChange={onOpenChange} />
  );
}
