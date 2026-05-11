import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';

interface ActionButtonsProps {
  onCreateNew: () => void;
  onOpenLocal: () => void;
}

export function ActionButtons({ onCreateNew, onOpenLocal }: ActionButtonsProps) {
  const { t } = useI18n();

  return (
    <div className="vault-actions">
      <button 
        className="vault-action-btn vault-action-btn--primary"
        onClick={onCreateNew}
      >
        <Icon name="common.add" size="md" />
        {t('vault.createNew')}
      </button>
      <button 
        className="vault-action-btn vault-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <Icon name="file.folderOpen" size="md" />
        {t('vault.openLocal')}
      </button>
    </div>
  );
}
