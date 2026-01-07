/**
 * ActionButtons - Create and Open vault buttons
 */

import { IconPlus, IconFolderOpen } from '@tabler/icons-react';

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
        <IconPlus size={18} />
        Create New
      </button>
      <button 
        className="vault-action-btn vault-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <IconFolderOpen size={18} />
        Open Local
      </button>
    </div>
  );
}
