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
                'w-9 h-9 flex items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200',
                iconButtonStyles,
                'text-[var(--chat-sidebar-text)] hover:!bg-white dark:hover:!bg-white hover:text-[#41a8ea] hover:!shadow-[0_6px_20px_rgba(0,0,0,0.055),inset_0_1px_0_rgba(255,255,255,0.7)] active:scale-95'
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
              "w-max min-w-52 rounded-[22px] border-transparent p-1.5 text-[var(--chat-sidebar-text)]",
              chatComposerPillSurfaceClass
            )}
          >
            {!webSearchEnabled && (
              <button
                type="button"
                onClick={handleEnableWebSearch}
                className={cn(
                  "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[16px] font-medium whitespace-nowrap transition-colors",
                  "text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]",
                  getSidebarIdleRowSurfaceClass('chat')
                )}
              >
                <Icon name="file.public" size="md" className="text-[#41a8ea]" />
                <span>{t('chat.webSearch')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleTriggerMentionSelect}
              className={cn(
                "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[16px] font-medium whitespace-nowrap transition-colors",
                "text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]",
                getSidebarIdleRowSurfaceClass('chat')
              )}
            >
              <span className="flex size-5 items-center justify-center text-[17px] font-semibold leading-none text-[#41a8ea]">@</span>
              <span>{t('chat.mentionFileOrFolder')}</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerFileSelect}
              className={cn(
                "group/chat-action flex h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[16px] font-medium whitespace-nowrap transition-colors",
                "text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]",
                getSidebarIdleRowSurfaceClass('chat')
              )}
            >
              <Icon name="file.attach" size="md" className="text-[#41a8ea]" />
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
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--chat-sidebar-row-active)] text-[var(--sidebar-row-selected-text)] transition-[background-color,color,transform] duration-200 hover:bg-[var(--chat-sidebar-row-active)] hover:text-[var(--sidebar-row-selected-text)] active:scale-95"
          >
            <Icon name="file.public" size="md" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLoading ? (
          <button
            onClick={onStop}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#41a8ea] text-white shadow-sm shadow-[#41a8ea]/25 transition-[box-shadow,transform] duration-200 hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' }}
          >
            <Icon name="media.stop" size="md" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSubmit}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-[background-color,color,box-shadow,opacity,transform] duration-200',
              canSubmit
                ? 'bg-[#41a8ea] text-white shadow-md shadow-[#41a8ea]/25 hover:scale-105 active:scale-95'
                : canSend
                  ? 'bg-[#41a8ea] text-white opacity-60 shadow-sm shadow-[#41a8ea]/15 cursor-default'
                : 'bg-[#e7f3ff] text-[#9acff3] cursor-default'
            )}
            style={canSubmit ? { boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' } : undefined}
          >
            <Icon name="common.send" size="md" />
          </button>
        )}
      </div>
    </div>
  );
}
