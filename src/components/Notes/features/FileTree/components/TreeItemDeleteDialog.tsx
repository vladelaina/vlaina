import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface TreeItemDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  itemType: 'Note' | 'Folder';
  onConfirm: () => void | Promise<void>;
}

export function TreeItemDeleteDialog({
  open,
  onOpenChange,
  itemLabel,
  itemType,
  onConfirm,
}: TreeItemDeleteDialogProps) {
  return (
    <ConfirmDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onConfirm={() => {
        void onConfirm();
      }}
      title={`Delete ${itemType}`}
      description={`Are you sure you want to delete "${itemLabel}"? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
    />
  );
}
