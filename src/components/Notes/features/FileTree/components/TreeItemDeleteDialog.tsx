import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  const itemTypeLabel = itemType === 'Folder' ? t('notes.folder') : t('notes.file');

  return (
    <ConfirmDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onConfirm={() => {
        void Promise.resolve(onConfirm()).catch(() => undefined);
      }}
      title={t('sidebar.deleteItemTitle', { itemType: itemTypeLabel })}
      description={t('sidebar.deleteItemDescription', { itemLabel })}
      confirmText={t('sidebar.delete')}
      cancelText={t('common.cancel')}
      variant="danger"
    />
  );
}
