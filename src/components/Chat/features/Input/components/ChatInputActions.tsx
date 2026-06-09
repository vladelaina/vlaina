import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, iconButtonStyles } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '../composerStyles';
import { getSidebarIdleRowSurfaceClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { useI18n } from '@/lib/i18n';

interface ChatInputActionsProps {
  onTriggerFileSelect: () => void;
  onTriggerMentionSelect: () => void;
  isLoading: boolean;
  canSend: boolean;
  canSubmit: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  onRequestComposerFocus: () => void;
  onStop: () => void;
  onSend: () => void;
}

export function ChatInputActions({
  onTriggerFileSelect,
  onTriggerMentionSelect,
  isLoading,
  canSend,
  canSubmit,
  webSearchEnabled,
  onToggleWebSearch,
  onRequestComposerFocus,
  onStop,
  onSend,
}: ChatInputActionsProps) {
  const { t } = useI18n();
  const [actionsOpen, setActionsOpen] = useState(false);
  const restoreComposerFocusOnCloseRef = useRef(false);

  const handleTriggerFileSelect = () => {
    setActionsOpen(false);
    onTriggerFileSelect();
  };

  const handleTriggerMentionSelect = () => {
    restoreComposerFocusOnCloseRef.current = true;
    setActionsOpen(false);
    onTriggerMentionSelect();
  };

  const handleEnableWebSearch = () => {
    restoreComposerFocusOnCloseRef.current = true;
    setActionsOpen(false);
    if (!webSearchEnabled) {
      onToggleWebSearch();
    }
    onRequestComposerFocus();
  };

  const handleDisableWebSearch = () => {
    onToggleWebSearch();
    onRequestComposerFocus();
  };

  return (
    <div className="flex items-center justify-between px-2 pb-2 pl-3">
      <div className="flex items-center gap-2">
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('chat.openActions')}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-[var(--vlaina-duration-200)]',
                iconButtonStyles,
                '!bg-transparent !shadow-none text-[var(--vlaina-accent)] hover:!bg-[var(--vlaina-color-pill-surface-hover)] hover:!shadow-[var(--vlaina-shadow-menu-hover)] hover:text-[var(--vlaina-accent-hover)] active:scale-[var(--vlaina-scale-95)]'
              )}
            >
              <Icon name="common.add" size="md" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            onCloseAutoFocus={(event) => {
              if (!restoreComposerFocusOnCloseRef.current) {
                return;
              }
              restoreComposerFocusOnCloseRef.current = false;
              event.preventDefault();
              onRequestComposerFocus();
            }}
            className={cn(
              "w-max min-w-52 rounded-[var(--vlaina-radius-22px)] border-transparent p-1.5 text-[var(--vlaina-sidebar-chat-text)]",
              chatComposerPillSurfaceClass
            )}
          >
            {!webSearchEnabled && (
              <button
                type="button"
                onClick={handleEnableWebSearch}
                className={cn(
                  "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[var(--vlaina-font-base)] font-medium whitespace-nowrap transition-colors",
                  "text-[var(--vlaina-sidebar-chat-text)] hover:bg-[var(--vlaina-sidebar-chat-row-hover)]",
                  getSidebarIdleRowSurfaceClass('chat')
                )}
              >
                <Icon name="file.public" size="md" className="text-[var(--vlaina-accent)]" />
                <span>{t('chat.webSearch')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleTriggerMentionSelect}
              className={cn(
                "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[var(--vlaina-font-base)] font-medium whitespace-nowrap transition-colors",
                "text-[var(--vlaina-sidebar-chat-text)] hover:bg-[var(--vlaina-sidebar-chat-row-hover)]",
                getSidebarIdleRowSurfaceClass('chat')
              )}
            >
              <span className="flex size-5 items-center justify-center text-[var(--vlaina-font-h6)] font-semibold leading-none !text-[var(--vlaina-accent)]">@</span>
              <span>{t('chat.mentionFileOrFolder')}</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerFileSelect}
              className={cn(
                "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[var(--vlaina-font-base)] font-medium whitespace-nowrap transition-colors",
                "text-[var(--vlaina-sidebar-chat-text)] hover:bg-[var(--vlaina-sidebar-chat-row-hover)]",
                getSidebarIdleRowSurfaceClass('chat')
              )}
            >
              <Icon name="file.attach" size="md" className="text-[var(--vlaina-accent)]" />
              <span>{t('chat.uploadFile')}</span>
            </button>
          </PopoverContent>
        </Popover>
        {webSearchEnabled && (
          <button
            type="button"
            aria-pressed="true"
            aria-label={t('chat.disableWebSearch')}
            onClick={handleDisableWebSearch}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--vlaina-sidebar-chat-row-active)] text-[var(--vlaina-sidebar-row-selected-text)] transition-[background-color,color,transform] duration-[var(--vlaina-duration-200)] hover:bg-[var(--vlaina-sidebar-chat-row-active)] hover:text-[var(--vlaina-sidebar-row-selected-text)] active:scale-[var(--vlaina-scale-95)]"
          >
            <Icon name="file.public" size="md" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLoading ? (
          <button
            onClick={onStop}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--vlaina-color-pill-surface-hover)] text-[var(--vlaina-accent)] shadow-[var(--vlaina-shadow-menu-hover)] transition-[color,box-shadow,transform] duration-[var(--vlaina-duration-200)] hover:text-[var(--vlaina-accent-hover)] hover:scale-[var(--vlaina-scale-105)] active:scale-[var(--vlaina-scale-95)]"
          >
            <Icon name="media.stop" size="md" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSubmit}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-[background-color,color,box-shadow,opacity,transform] duration-[var(--vlaina-duration-200)]',
              canSubmit
                ? 'bg-[var(--vlaina-color-pill-surface-hover)] text-[var(--vlaina-accent)] shadow-[var(--vlaina-shadow-menu-hover)] hover:text-[var(--vlaina-accent-hover)] hover:scale-[var(--vlaina-scale-105)] active:scale-[var(--vlaina-scale-95)]'
                : canSend
                  ? 'bg-[var(--vlaina-color-pill-surface-hover)] text-[var(--vlaina-accent)] opacity-[var(--vlaina-opacity-60)] shadow-[var(--vlaina-shadow-menu-hover)] cursor-default'
                  : 'bg-[var(--vlaina-color-pill-surface-hover)] text-[var(--vlaina-accent)] opacity-[var(--vlaina-opacity-45)] shadow-[var(--vlaina-shadow-menu-hover)] cursor-default'
            )}
          >
            <Icon name="common.send" size="md" />
          </button>
        )}
      </div>
    </div>
  );
}
