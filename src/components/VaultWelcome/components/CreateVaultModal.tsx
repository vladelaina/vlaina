
/**
 * CreateVaultModal - Modal for creating new vault
 */

import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { useVaultStore } from '@/stores/useVaultStore';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateVaultModal({ isOpen, onClose }: CreateVaultModalProps) {
  const { createVault, isLoading, error, clearError } = useVaultStore();
  const [name, setName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setParentPath('');
      clearError();
    }
  }, [isOpen, clearError]);

  // Auto-scroll to end of path when it changes
  useEffect(() => {
    if (pathInputRef.current) {
      pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
    }
  }, [parentPath, isOpen]);

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Parent Folder for New Vault',
    });

    if (selected && typeof selected === 'string') {
      setParentPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !parentPath.trim()) return;

    // Create vault folder inside the selected parent folder
    const vaultPath = await join(parentPath.trim(), name.trim());
    const success = await createVault(name.trim(), vaultPath);
    if (success) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && name.trim() && parentPath.trim()) {
      handleCreate();
    }
  };

  if (!isOpen) return null;

  const canCreate = name.trim() && parentPath.trim() && !isLoading;

  return (
    <div className="vault-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="vault-modal__title">Create New Vault</h2>

        <div className="vault-modal__field">
          <label className="vault-modal__label">Vault Name</label>
          <input
            type="text"
            className="vault-modal__input"
            placeholder="My Notes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="vault-modal__field">
          <label className="vault-modal__label">Parent Folder</label>
          <div className="vault-modal__path-input">
            <input
              ref={pathInputRef}
              type="text"
              className="vault-modal__input"
              placeholder="Select a folder..."
              value={parentPath}
              title={parentPath} // Show full path on hover
              readOnly
            />
            <button
              className="vault-modal__browse-btn"
              onClick={handleBrowse}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Path preview removed for cleaner UI */}

        {error && (
          <div className="vault-modal__error">{error}</div>
        )}

        <div className="vault-modal__actions">
          <button
            className="vault-modal__btn vault-modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="vault-modal__btn vault-modal__btn--create"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {isLoading ? 'Creating...' : 'Create Vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
