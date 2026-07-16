import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useI18n } from '@/lib/i18n';

interface ComputerUseEnableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ComputerUseEnableDialog({ isOpen, onClose, onConfirm }: ComputerUseEnableDialogProps) {
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
    />
  );
}
