import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVaultStore } from '@/stores/useVaultStore';
import { openDialog, hasNativeDialogs } from '@/lib/storage/dialog';
import { joinPath, isWeb } from '@/lib/storage/adapter';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { useI18n } from '@/lib/i18n';
import { themeBackdropTokens, themeDomStyleTokens, themeMotionTokens } from '@/styles/themeTokens';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateVaultModal({ isOpen, onClose }: CreateVaultModalProps) {
  const { t } = useI18n();
  const { createVault, isLoading, error, clearError } = useVaultStore();
  const [name, setName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const pathInputRef = useRef<HTMLInputElement>(null);
  const isWebPlatform = isWeb();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setParentPath(isWebPlatform ? '/vaults' : '');
      clearError();
    }
  }, [isOpen, clearError, isWebPlatform]);

  useEffect(() => {
    if (pathInputRef.current && document.activeElement !== pathInputRef.current) {
      pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
    }
  }, [parentPath, isOpen]);

  const handleBrowse = async () => {
    if (!hasNativeDialogs()) {
      pathInputRef.current?.focus();
      return;
    }

    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('vault.selectParentFolderTitle'),
    });

    if (selected && typeof selected === 'string') {
      setParentPath(selected);
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

    const vaultPath = await joinPath(parentPath.trim(), name.trim());
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
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <BlurBackdrop
            onClick={onClose}
            overlayClassName="bg-[var(--vlaina-color-backdrop-soft)]"
            zIndex={themeBackdropTokens.createVaultZIndex}
            blurPx={themeBackdropTokens.createVaultBlurPx}
            duration={themeBackdropTokens.createVaultDurationSeconds}
          />
          <div
            className="fixed inset-0 z-[var(--vlaina-z-modal-max)] flex items-center justify-center"
            onKeyDown={handleKeyDown}
          >
            <motion.div
              className="vault-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{
                opacity: themeMotionTokens.opacityHidden,
                scale: themeMotionTokens.vaultModalInitialScale,
                y: themeMotionTokens.vaultModalY,
              }}
              animate={{
                opacity: themeMotionTokens.opacityVisible,
                scale: themeMotionTokens.vaultModalVisibleScale,
                y: themeMotionTokens.vaultModalVisibleY,
              }}
              exit={{
                opacity: themeMotionTokens.opacityHidden,
                scale: themeMotionTokens.vaultModalInitialScale,
                y: themeMotionTokens.vaultModalY,
              }}
              transition={{
                duration: themeMotionTokens.vaultModalDuration,
                ease: themeMotionTokens.vaultModalEase,
              }}
            >
              <h2 className="vault-modal__title">{t('vault.createNewVault')}</h2>

              <div className="vault-modal__field">
                <label className="vault-modal__label">{t('vault.name')}</label>
                <input
                  type="text"
                  spellCheck={false}
                  className="vault-modal__input"
                  placeholder={t('vault.myNotesPlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey && !parentPath && hasNativeDialogs()) {
                      e.preventDefault();
                      pathInputRef.current?.focus();
                      handleBrowse();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="vault-modal__field">
                <label className="vault-modal__label">
                  {isWebPlatform ? t('vault.path') : t('vault.parentFolder')}
                </label>
                <div className="vault-modal__path-input">
                  <input
                    ref={pathInputRef}
                    type="text"
                    spellCheck={false}
                    className="vault-modal__input"
                    placeholder={isWebPlatform ? t('vault.pathPlaceholder') : t('vault.selectFolderPlaceholder')}
                    value={parentPath}
                    onChange={(e) => setParentPath(e.target.value)}
                    onBlur={(e) => {
                      const target = e.target;
                      requestAnimationFrame(() => {
                        target.scrollLeft = target.scrollWidth;
                      });
                    }}
                    title={parentPath}
                    onClick={() => !parentPath && !isWebPlatform && handleBrowse()}
                    readOnly={!parentPath && !isWebPlatform}
                    style={{
                      cursor: !parentPath && !isWebPlatform
                        ? themeDomStyleTokens.cursorPointer
                        : themeDomStyleTokens.cursorText,
                    }}
                  />
                  {hasNativeDialogs() && (
                    <button className="vault-modal__browse-btn" onClick={handleBrowse}>
                      {t('common.browse')}
                    </button>
                  )}
                </div>
                {isWebPlatform && (
                  <p className="vault-modal__hint">
                    {t('vault.localStorageHint')}
                  </p>
                )}
              </div>

              {error && <div className="vault-modal__error">{error}</div>}

              <div className="vault-modal__actions">
                <button className="vault-modal__btn vault-modal__btn--cancel" onClick={onClose}>
                  {t('common.cancel')}
                </button>

                <button
                  className="vault-modal__btn vault-modal__btn--create"
                  onClick={handleCreate}
                  disabled={!canCreate}
                >
                  {isLoading ? t('common.creating') : t('vault.createVault')}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
