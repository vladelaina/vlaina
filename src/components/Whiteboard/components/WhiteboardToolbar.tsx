import { Icon, type IconName } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { themeIconTokens, themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  WHITEBOARD_TOOLS,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';

interface WhiteboardToolbarProps {
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  onClear: () => void;
  onResetView: () => void;
  onToolChange: (tool: WhiteboardTool) => void;
  onZoomChange: (delta: number) => void;
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            'inline-flex size-[var(--vlaina-size-36px)] cursor-pointer items-center justify-center rounded-[var(--vlaina-radius-8px)] border border-transparent text-[var(--vlaina-color-text-secondary)] transition-colors',
            active
              ? 'border-[var(--vlaina-color-accent-border-muted)] bg-[var(--vlaina-color-accent-soft-bg)] text-[var(--vlaina-color-accent)]'
              : 'hover:bg-[var(--vlaina-color-control-hover-bg)] hover:text-[var(--vlaina-color-control-hover-fg)]',
          )}
        >
          <Icon name={icon} size={themeIconTokens.sizeMd} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function WhiteboardToolbar({
  tool,
  viewport,
  onClear,
  onResetView,
  onToolChange,
  onZoomChange,
}: WhiteboardToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="absolute left-4 top-4 z-[var(--vlaina-z-20)] flex items-center gap-1 rounded-[var(--vlaina-radius-12px)] border border-[var(--vlaina-color-subtle-border)] bg-[var(--vlaina-color-floating-surface-translucent)] p-1 shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-blur-sm)]">
      {WHITEBOARD_TOOLS.map((item) => (
        <ToolButton
          key={item.id}
          active={tool === item.id}
          icon={item.icon}
          label={t(item.labelKey)}
          onClick={() => onToolChange(item.id)}
        />
      ))}
      <div className="mx-1 h-[var(--vlaina-size-24px)] w-px bg-[var(--vlaina-color-subtle-border)]" />
      <ToolButton
        active={false}
        icon="common.remove"
        label={t('whiteboard.zoomOut')}
        onClick={() => onZoomChange(-themeWhiteboardTokens.zoomStep)}
      />
      <span className="min-w-[var(--vlaina-size-56px)] text-center text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-color-text-secondary)]">
        {Math.round(viewport.zoom * 100)}%
      </span>
      <ToolButton
        active={false}
        icon="common.add"
        label={t('whiteboard.zoomIn')}
        onClick={() => onZoomChange(themeWhiteboardTokens.zoomStep)}
      />
      <ToolButton
        active={false}
        icon="common.refresh"
        label={t('whiteboard.resetView')}
        onClick={onResetView}
      />
      <ToolButton active={false} icon="common.delete" label={t('whiteboard.clear')} onClick={onClear} />
    </div>
  );
}
