/**
 * ActionButtons - Create and Open vault buttons
 */

import { MdAdd, MdFolderOpen } from 'react-icons/md';

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
        <MdAdd size={18} />
        Create New
      </button>
      <button 
        className="vault-action-btn vault-action-btn--secondary"
        onClick={onOpenLocal}
      >
        <MdFolderOpen size={18} />
        Open Local
      </button>
    </div>
  );
}