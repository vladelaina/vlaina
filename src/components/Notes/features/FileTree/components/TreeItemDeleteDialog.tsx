import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TreeItemDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  itemType: 'Note' | 'Folder';
  onConfirm: () => Promise<void>;
}

export function TreeItemDeleteDialog({
  open,
  onOpenChange,
  itemLabel,
  itemType,
  onConfirm,
}: TreeItemDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] border-[var(--neko-border)] bg-[var(--neko-bg-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--neko-text-primary)]">
            Delete {itemType}
          </DialogTitle>
          <DialogDescription className="text-[var(--neko-text-secondary)]">
            Are you sure you want to delete "{itemLabel}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className={cn(
              'rounded-md bg-[var(--neko-bg-secondary)] px-4 py-2 text-sm hover:bg-[var(--neko-hover)]'
            )}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            className="rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
