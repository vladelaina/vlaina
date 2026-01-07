/**
 * CreateVaultModal - Modal for creating new vault
 */

import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useVaultStore } from '@/stores/useVaultStore';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateVaultModal({ isOpen, onClose }: CreateVaultModalProps) {
  const { createVault, isLoading, error, clearError } = useVaultStore();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPath('');
      clearError();
    }
  }, [isOpen, clearError]);

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Location for New Vault',
    });
    
    if (selected && typeof selected === 'string') {
      setPath(selected);
      // Auto-fill name from folder if empty
      if (!name) {
        const folderName = selected.replace(/\\/g, '/').split('/').pop() || '';
        setName(folderName);
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !path.trim()) return;
    
    const success = await createVault(name.trim(), path.trim());
    if (success) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && name.trim() && path.trim()) {
      handleCreate();
    }
  };

  if (!isOpen) return null;

  const canCreate = name.trim() && path.trim() && !isLoading;

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
          <label className="vault-modal__label">Location</label>
          <div className="vault-modal__path-input">
            <input
              type="text"
              className="vault-modal__input"
              placeholder="Select a folder..."
              value={path}
              onChange={(e) => setPath(e.target.value)}
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
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
