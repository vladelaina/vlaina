/**
 * ActionButtons - Create and Open vault buttons
 */

import { Plus, FolderOpen } from 'lucide-react';

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
        <Plus size={18} />
        Create New
      </button>
      <button 
        className="vault-action-btn vault-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <FolderOpen size={18} />
        Open Local
      </button>
    </div>
  );
}
