import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';

interface ActionButtonsProps {
  onCreateNew: () => void;
  onOpenLocal: () => void;
}

export function ActionButtons({ onCreateNew, onOpenLocal }: ActionButtonsProps) {
  const { t } = useI18n();

  return (
    <div className="notes-root-actions">
      <button 
        className="notes-root-action-btn notes-root-action-btn--primary"
        onClick={onCreateNew}
      >
        <Icon name="common.add" size="md" />
        {t('notesRoot.createNew')}
      </button>
      <button 
        className="notes-root-action-btn notes-root-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <Icon name="file.folderOpen" size="md" />
        {t('notesRoot.openLocal')}
      </button>
    </div>
  );
}
