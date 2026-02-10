import { Icon } from '@/components/ui/icons';

interface ActionButtonsProps {
  onCreateNew: () => void;
  onOpenLocal: () => void;
}

export function ActionButtons({ onCreateNew, onOpenLocal }: ActionButtonsProps) {
  return (
    <div className="vault-actions">
      <button 
        className="vault-action-btn vault-action-btn--primary"
        onClick={onCreateNew}
      >
        <Icon name="common.add" size="md" />
        Create New
      </button>
      <button 
        className="vault-action-btn vault-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <Icon name="file.folderOpen" size="md" />
        Open Local
      </button>
    </div>
  );
}