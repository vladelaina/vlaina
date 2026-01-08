
/**
 * CreateVaultModal - Modal for creating new vault
 */

import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { AnimatePresence, motion } from 'framer-motion';
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

  // Auto-scroll to end of path when it changes (only if not manually editing)
  useEffect(() => {
    if (pathInputRef.current && document.activeElement !== pathInputRef.current) {
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
      // Focus the path input after selection so user can review or edit
      requestAnimationFrame(() => {
        if (pathInputRef.current) {
          pathInputRef.current.focus();
          pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
        }
      });
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

  const canCreate = name.trim() && parentPath.trim() && !isLoading;
  // cubic-bezier(0.16, 1, 0.3, 1) as a stronger curve
  const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="vault-modal-overlay"
          onClick={onClose}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.3, ease: APPLE_EASE }}
        >
          <motion.div
            className="vault-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }} // Slightly different ease for modal pop
          >
            <h2 className="vault-modal__title">Create New Vault</h2>

            <div className="vault-modal__field">
              <label className="vault-modal__label">Vault Name</label>
              <input
                type="text"
                className="vault-modal__input"
                placeholder="My Notes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // If Tab is pressed and path is empty, trigger browse immediately
                  if (e.key === 'Tab' && !e.shiftKey && !parentPath) {
                    e.preventDefault();
                    // Move focus to path input first to set correct origin for dialog return
                    pathInputRef.current?.focus();
                    handleBrowse();
                  }
                }}
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
                  onChange={(e) => setParentPath(e.target.value)}
                  onBlur={(e) => {
                    // Force scroll to end on blur so user sees the folder name
                    const target = e.target;
                    requestAnimationFrame(() => {
                      target.scrollLeft = target.scrollWidth;
                    });
                  }}
                  title={parentPath} // Show full path on hover
                  onClick={() => !parentPath && handleBrowse()}
                  readOnly={!parentPath}
                  style={{ cursor: !parentPath ? 'pointer' : 'text' }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
