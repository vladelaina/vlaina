import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useI18n } from '@/lib/i18n';

interface ComputerUseEnableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRequestComposerFocus: () => void;
}

export function ComputerUseEnableDialog({
  isOpen,
  onClose,
  onConfirm,
  onRequestComposerFocus,
}: ComputerUseEnableDialogProps) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('chat.computerUse.enableTitle')}
      description={t('chat.computerUse.enableDescription')}
      confirmText={t('chat.computerUse.enableConfirm')}
      cancelText={t('common.cancel')}
      initialFocus="cancel"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRequestComposerFocus();
      }}
    />
  );
}
