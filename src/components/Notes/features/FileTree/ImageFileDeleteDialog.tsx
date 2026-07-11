import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useI18n } from '@/lib/i18n';
import type { ImageFileReference } from './imageFileReferences';

export function ImageFileDeleteDialog({
  open,
  onOpenChange,
  imageName,
  references,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageName: string;
  references: ImageFileReference[];
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const referenceNames = references.slice(0, 5).map((reference) => reference.name).join(', ');
  const description = references.length > 0
    ? t('notes.deleteReferencedImageDescription', {
        count: references.length,
        itemLabel: imageName,
        references: referenceNames,
      })
    : t('sidebar.deleteItemDescription', { itemLabel: imageName });

  return (
    <ConfirmDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onConfirm={onConfirm}
      title={t('sidebar.deleteItemTitle', { itemType: t('editor.slash.image') })}
      description={description}
      confirmText={t('sidebar.delete')}
      cancelText={t('common.cancel')}
      variant="danger"
      initialFocus="cancel"
    />
  );
}
