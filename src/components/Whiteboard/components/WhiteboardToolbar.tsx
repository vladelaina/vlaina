import { memo, useRef, type ChangeEvent, type ReactNode } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon, type IconName } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { themeIconTokens, themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  WHITEBOARD_TOOL_GROUPS,
  isBrushTool,
  isDrawingTool,
  type WhiteboardBrushColors,
  type WhiteboardBrushSizes,
  type WhiteboardBrushTool,
  type WhiteboardDrawingTool,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';

interface WhiteboardToolbarProps {
  canRedo: boolean;
  canUndo: boolean;
  brushColors: WhiteboardBrushColors;
  brushSizes: WhiteboardBrushSizes;
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  onBrushColorChange: (tool: WhiteboardDrawingTool, color: string) => void;
  onBrushSizeChange: (tool: WhiteboardBrushTool, deltaY: number) => void;
  onClear: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onFitView: () => void;
  onImageAdd: (file: File) => void;
  onPaste: () => void;
  onRedo: () => void;
  onResetView: () => void;
  onToolChange: (tool: WhiteboardTool) => void;
  onUndo: () => void;
  onZoomChange: (delta: number) => void;
}

function ToolButton({
  active,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
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
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'inline-flex size-[var(--vlaina-size-36px)] shrink-0 cursor-pointer items-center justify-center rounded-[var(--vlaina-radius-circle)] border border-transparent text-[var(--vlaina-color-text-secondary)] transition-[background-color,border-color,color,transform] duration-[var(--vlaina-duration-150)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-35)]',
            active
              ? 'border-[var(--vlaina-color-accent-border-muted)] bg-[var(--vlaina-accent-light)] text-[var(--vlaina-accent)] shadow-[var(--vlaina-shadow-selection-soft)]'
              : 'hover:bg-[var(--vlaina-color-control-hover-bg)] hover:text-[var(--vlaina-color-control-hover-fg)] active:scale-[var(--vlaina-scale-95)]',
          )}
        >
          <Icon name={icon} size={themeIconTokens.sizeMd} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-11 shrink-0 items-center gap-1 rounded-[var(--vlaina-radius-pill)] px-1.5',
        chatComposerPillSurfaceClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

export const WhiteboardToolbar = memo(function WhiteboardToolbar({
  canRedo,
  canUndo,
  brushColors,
  brushSizes,
  tool,
  viewport,
  onBrushColorChange,
  onBrushSizeChange,
  onClear,
  onCopy,
  onDuplicate,
  onExport,
  onFitView,
  onImageAdd,
  onPaste,
  onRedo,
  onResetView,
  onToolChange,
  onUndo,
  onZoomChange,
}: WhiteboardToolbarProps) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const colorTool = isDrawingTool(tool) ? tool : null;
  const sizeTool = isBrushTool(tool) ? tool : null;
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImageAdd(file);
  };
  const handleImageSelect = () => {
    const input = imageInputRef.current;
    if (!input) return;

    input.value = '';
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }
    input.click();
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-4 z-[var(--vlaina-z-20)] flex justify-center">
      <div
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-[var(--vlaina-radius-pill)] p-1.5 shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]',
          chatComposerPillSurfaceClass,
        )}
      >
        {WHITEBOARD_TOOL_GROUPS.map((group, groupIndex) => (
          <ToolbarGroup key={groupIndex}>
            {group.map((item) => (
              <ToolButton
                key={item.id}
                active={tool === item.id}
                icon={item.icon}
                label={t(item.labelKey)}
                onClick={() => onToolChange(item.id)}
              />
            ))}
          </ToolbarGroup>
        ))}
        {colorTool ? (
          <ToolbarGroup>
            {themeWhiteboardTokens.brushColorSwatches.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={brushColors[colorTool] === color}
                onClick={() => onBrushColorChange(colorTool, color)}
                className={cn(
                  'size-[var(--vlaina-size-24px)] rounded-[var(--vlaina-radius-circle)] border transition-transform',
                  brushColors[colorTool] === color
                    ? 'border-[var(--vlaina-color-whiteboard-selected)] scale-[var(--vlaina-scale-110)]'
                    : 'border-[var(--vlaina-color-subtle-border-strong)] hover:scale-[var(--vlaina-scale-105)]',
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </ToolbarGroup>
        ) : null}
        {sizeTool ? (
          <ToolbarGroup>
            <ToolButton
              active={false}
              icon="common.remove"
              label={t('whiteboard.decreaseBrushSize')}
              onClick={() => onBrushSizeChange(sizeTool, themeWhiteboardTokens.brushWheelButtonDelta)}
            />
            <div
              aria-label={t('whiteboard.brushSize')}
              className="min-w-[var(--vlaina-size-48px)] rounded-[var(--vlaina-radius-circle)] px-3 py-1 text-center text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-color-text-secondary)]"
            >
              {Math.round(brushSizes[sizeTool] * 100)}%
            </div>
            <ToolButton
              active={false}
              icon="common.add"
              label={t('whiteboard.increaseBrushSize')}
              onClick={() => onBrushSizeChange(sizeTool, -themeWhiteboardTokens.brushWheelButtonDelta)}
            />
          </ToolbarGroup>
        ) : null}
        <ToolbarGroup>
          <ToolButton active={false} disabled={!canUndo} icon="common.undo" label={t('whiteboard.undo')} onClick={onUndo} />
          <ToolButton active={false} disabled={!canRedo} icon="common.redo" label={t('whiteboard.redo')} onClick={onRedo} />
          <ToolButton active={false} icon="common.copy" label={t('whiteboard.copy')} onClick={onCopy} />
          <ToolButton active={false} icon="common.add" label={t('whiteboard.duplicate')} onClick={onDuplicate} />
          <ToolButton active={false} icon="common.upload" label={t('whiteboard.paste')} onClick={onPaste} />
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolButton
            active={false}
            icon="common.remove"
            label={t('whiteboard.zoomOut')}
            onClick={() => onZoomChange(-themeWhiteboardTokens.zoomStep)}
          />
          <span className="min-w-[var(--vlaina-size-56px)] shrink-0 text-center text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-color-text-secondary)]">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <ToolButton
            active={false}
            icon="common.add"
            label={t('whiteboard.zoomIn')}
            onClick={() => onZoomChange(themeWhiteboardTokens.zoomStep)}
          />
          <ToolButton active={false} icon="common.refresh" label={t('whiteboard.resetView')} onClick={onResetView} />
          <ToolButton active={false} icon="nav.fullscreen" label={t('whiteboard.fitView')} onClick={onFitView} />
        </ToolbarGroup>
        <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
        <ToolbarGroup>
          <ToolButton active={false} icon="common.download" label={t('whiteboard.exportPng')} onClick={onExport} />
          <ToolButton active={false} icon="whiteboard.image" label={t('whiteboard.addImage')} onClick={handleImageSelect} />
          <ToolButton active={false} icon="common.delete" label={t('whiteboard.clear')} onClick={onClear} />
        </ToolbarGroup>
      </div>
    </div>
  );
});
