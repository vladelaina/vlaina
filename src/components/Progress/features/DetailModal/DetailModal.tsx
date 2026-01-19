import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ProgressOrCounter } from '@/stores/useProgressStore';
import { AppIcon } from '@/components/common/AppIcon';
import { useDetailModal } from './useDetailModal';
import { DetailActions } from './DetailActions';
import { DetailModalContent } from './DetailModalContent';
import { DetailModalFooter } from './DetailModalFooter';
import { SPRING_SNAPPY, SPRING_GENTLE } from '@/lib/animations';
import { useGlobalIconUpload } from '@/components/common/UniversalIconPicker/hooks/useGlobalIconUpload';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';

// Get window dynamically for multi-window support
const getWindow = () => getCurrentWindow();

interface DetailModalProps {
  item: ProgressOrCounter | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<ProgressOrCounter>) => void;
  onDelete: (id: string) => void;
  onPreviewChange?: (icon?: string, title?: string, iconSize?: number) => void;
}

export function DetailModal({
  item,
  onClose,
  onUpdate,
  onDelete,
  onPreviewChange,
}: DetailModalProps) {
  // Use custom hook for state management
  const {
    isEditing,
    focusTarget,
    showMenu,
    displayItem,
    setShowMenu,
    handleClose,
    handleCommit,
    handleCancelEdit,
    handleIconChange,
    updateDraft,
    handleQuickUpdate,
    startEditing,
  } = useDetailModal({ item, onClose, onUpdate, onPreviewChange });

  // Global Icon Upload
  const { customIcons, onUploadFile, onDeleteCustomIcon } = useGlobalIconUpload();
  const imageLoader = useCallback(async (src: string) => {
      if (!src.startsWith('img:')) return src;
      return await loadImageAsBlob(src.substring(4));
  }, []);

  // Adaptive Scaling Logic (Direct DOM for Performance)
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!wrapperRef.current) return;

      const h = window.innerHeight;
      const w = window.innerWidth;
      // Target Card Size: 360x520 + 40px padding
      const scaleH = Math.min(1, (h - 40) / 520);
      const scaleW = Math.min(1, (w - 40) / 360);
      const s = Math.min(scaleH, scaleW);

      wrapperRef.current.style.transform = `scale(${s})`;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial calculation

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Keyboard Shortcuts (Enter to Close when not editing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isEditing && item) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, item, handleClose]);

  if (!displayItem) return null;

  const percentage =
    displayItem.type === 'progress'
      ? Math.min(100, Math.max(0, (displayItem.current / displayItem.total) * 100))
      : 0;
  const fillHeight = displayItem.type === 'progress' ? `${percentage}%` : '0%';

  // Action handlers
  const handleArchive = () => {
    if (!item) return;
    onUpdate(item.id, {
      archived: !item.archived,
      current: item.archived ? 0 : item.current,
    });
    handleClose();
  };

  const handleReset = () => {
    if (!item) return;
    onUpdate(item.id, { current: 0 });
  };

  const handleDeleteItem = () => {
    if (!item) return;
    onDelete(item.id);
    handleClose();
  };

  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop - Blur & Dim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed -inset-[50%] bg-zinc-100/60 dark:bg-black/80 backdrop-blur-xl z-50"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing) {
                handleCancelEdit();
                return;
              }
              // Only close modal if no sub-states are active
              handleClose();
            }}
          />

          {/* Draggable Header Zone */}
          <div
            className="fixed top-0 inset-x-0 h-12 z-50 cursor-default"
            onMouseDown={(e) => {
              e.preventDefault();
              getWindow().startDragging();
            }}
          />

          {/* The Hero Card */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            {/* Responsive Wrapper - Instant Scale, No Lag */}
            <div ref={wrapperRef} className="origin-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={SPRING_SNAPPY}
                className="
                  relative w-[360px] h-[580px]
                  bg-white dark:bg-zinc-900
                  rounded-[3rem]
                  shadow-2xl shadow-zinc-200/50 dark:shadow-black/80
                  overflow-hidden
                  pointer-events-auto
                  select-none
                  flex flex-col
                "
                onClick={(e) => {
                  e.stopPropagation();
                  // Auto-collapse menu when clicking empty space
                  if (showMenu) setShowMenu(false);
                  // Commit changes if clicking empty space while editing
                  if (isEditing) handleCommit();
                }}
              >
                {/* --- 1. The Liquid Soul (Background Fill) --- */}
                <LiquidBackground
                  fillHeight={fillHeight}
                  iconName={displayItem.icon}
                />

                {/* --- 2. Top Actions --- */}
                <DetailActions
                  showMenu={showMenu}
                  isArchived={item.archived || false}
                  onMenuToggle={setShowMenu}
                  onArchive={handleArchive}
                  onReset={handleReset}
                  onDelete={handleDeleteItem}
                  onClose={handleClose}
                />

                {/* --- 3. Hero Header (Icon + Title) --- */}
                <HeroIconHeader
                    id={displayItem.id}
                    icon={displayItem.icon ?? null}
                    onIconChange={(icon) => handleIconChange(icon ?? undefined)}
                    className="px-8 pt-12"
                    
                    // Title Logic
                    renderTitle={() => (
                        <div className="w-full flex justify-center">
                          {isEditing ? (
                            <textarea
                              autoFocus={focusTarget === 'title'}
                              value={displayItem.title}
                              rows={1}
                              ref={(el) => { if (el) adjustHeight(el); }}
                              onChange={(e) => {
                                updateDraft('title', e.target.value);
                                adjustHeight(e.target);
                              }}
                              className="text-center text-3xl font-medium bg-transparent border-none outline-none p-0 text-zinc-900 dark:text-zinc-100 w-full resize-none overflow-hidden placeholder:text-zinc-200 dark:placeholder:text-zinc-700 caret-zinc-400"
                              placeholder="Untitled"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCommit();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <h2
                              onClick={() => startEditing('title')}
                              className="text-3xl font-medium tracking-tight text-center text-zinc-900 dark:text-zinc-100 cursor-pointer hover:opacity-70 transition-opacity whitespace-pre-wrap break-words w-full"
                            >
                              {displayItem.title}
                            </h2>
                          )}
                        </div>
                    )}

                    customIcons={customIcons}
                    onUploadFile={onUploadFile}
                    onDeleteCustomIcon={onDeleteCustomIcon}
                    imageLoader={imageLoader}
                />

                {/* --- 4. Center Zone (The Tuning Engine) --- */}
                <DetailModalContent
                  displayItem={displayItem}
                  isEditing={isEditing}
                  focusTarget={focusTarget}
                  onStartEdit={startEditing}
                  onCommit={handleCommit}
                  onQuickUpdate={handleQuickUpdate}
                  onUpdateDraft={updateDraft}
                  onDirectUpdate={(data) => item && onUpdate(item.id, data)}
                />

                {/* --- 5. Footer: History Waveform --- */}
                <DetailModalFooter
                  displayItem={displayItem}
                  isEditing={isEditing}
                  onCommit={handleCommit}
                />
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Sub-component for background

interface LiquidBackgroundProps {
  fillHeight: string;
  iconName: string | undefined;
}

function LiquidBackground({ fillHeight, iconName }: LiquidBackgroundProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Base with Radial Glow */}
      <div className="absolute inset-0 bg-white dark:bg-zinc-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-50/80 via-transparent to-transparent dark:from-zinc-800/30 dark:to-transparent opacity-60" />

      {/* Liquid Level */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-zinc-50/50 dark:bg-zinc-800/50 backdrop-blur-[2px]"
        animate={{ height: fillHeight }}
        transition={SPRING_GENTLE}
      />

      {/* The Watermark Icon - Deeper & Larger */}
      {iconName && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] dark:opacity-[0.06] pointer-events-none scale-125 mix-blend-multiply dark:mix-blend-overlay">
          <AppIcon
            icon={iconName}
            size={320}
            className="text-zinc-900 dark:text-zinc-100 block"
          />
        </div>
      )}
    </div>
  );
}
