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
  type WhiteboardNoteColor,
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
  selectedNoteColor: WhiteboardNoteColor | null;
  onBrushColorChange: (tool: WhiteboardDrawingTool, color: string) => void;
  onBrushSizeChange: (tool: WhiteboardBrushTool, deltaY: number) => void;
  onClear: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onFitView: () => void;
  onImageAdd: (file: File) => void;
  onNoteColorChange: (color: WhiteboardNoteColor) => void;
  onPaste: () => void;
  onRedo: () => void;
  onResetView: () => void;
  onToolChange: (tool: WhiteboardTool) => void;
  onUndo: () => void;
  onZoomChange: (delta: number) => void;
}

function ToolbarButton({
  active = false,
  disabled = false,
  icon,
  indicatorColor,
  label,
  large = false,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: IconName;
  indicatorColor?: string;
  label: string;
  large?: boolean;
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
            'relative inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent text-[var(--vlaina-color-text-secondary)] transition-[background-color,border-color,color,transform,box-shadow] duration-[var(--vlaina-duration-150)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-35)]',
            large
              ? 'size-[var(--vlaina-size-44px)] rounded-[var(--vlaina-radius-12px)]'
              : 'size-[var(--vlaina-size-36px)] rounded-[var(--vlaina-radius-circle)]',
            active
              ? 'border-[var(--vlaina-color-accent-border-muted)] bg-[var(--vlaina-accent-light)] text-[var(--vlaina-accent)] shadow-[var(--vlaina-shadow-selection-soft)]'
              : 'hover:bg-[var(--vlaina-color-control-hover-bg)] hover:text-[var(--vlaina-color-control-hover-fg)] active:scale-[var(--vlaina-scale-95)]',
          )}
        >
          <Icon name={icon} size={large ? themeIconTokens.sizeLg : themeIconTokens.sizeMd} />
          {indicatorColor ? (
            <span
              aria-hidden="true"
              className="absolute bottom-1 h-[var(--vlaina-size-2px)] w-5 rounded-[var(--vlaina-radius-pill)]"
              style={{ backgroundColor: indicatorColor }}
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex shrink-0 items-center gap-1', className)}>{children}</div>;
}

const floatingPanelClassName = cn(
  'pointer-events-auto border border-[var(--vlaina-color-toolbar-border)] shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]',
  chatComposerPillSurfaceClass,
);

export const WhiteboardToolbar = memo(function WhiteboardToolbar(props: WhiteboardToolbarProps) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const colorTool = isDrawingTool(props.tool) ? props.tool : null;
  const sizeTool = isBrushTool(props.tool) ? props.tool : null;
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) props.onImageAdd(file);
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
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-[var(--vlaina-z-20)] flex max-w-[calc(100%-var(--vlaina-size-56px))] items-center gap-2">
        <ToolbarGroup className={cn('rounded-[var(--vlaina-radius-pill)] p-1', floatingPanelClassName)}>
          <ToolbarButton disabled={!props.canUndo} icon="common.undo" label={t('whiteboard.undo')} onClick={props.onUndo} />
          <ToolbarButton disabled={!props.canRedo} icon="common.redo" label={t('whiteboard.redo')} onClick={props.onRedo} />
        </ToolbarGroup>
        <ToolbarGroup className={cn('hidden rounded-[var(--vlaina-radius-pill)] p-1 sm:flex', floatingPanelClassName)}>
          <ToolbarButton icon="common.copy" label={t('whiteboard.copy')} onClick={props.onCopy} />
          <ToolbarButton icon="common.add" label={t('whiteboard.duplicate')} onClick={props.onDuplicate} />
          <ToolbarButton icon="common.upload" label={t('whiteboard.paste')} onClick={props.onPaste} />
          <ToolbarButton icon="whiteboard.image" label={t('whiteboard.addImage')} onClick={handleImageSelect} />
          <ToolbarButton icon="common.download" label={t('whiteboard.exportPng')} onClick={props.onExport} />
          <ToolbarButton icon="common.delete" label={t('whiteboard.clear')} onClick={props.onClear} />
        </ToolbarGroup>
      </div>

      <div className={cn('pointer-events-auto absolute left-3 top-16 z-[var(--vlaina-z-20)] flex items-center rounded-[var(--vlaina-radius-pill)] p-1 xl:bottom-4 xl:top-auto', floatingPanelClassName)}>
        <ToolbarButton icon="common.remove" label={t('whiteboard.zoomOut')} onClick={() => props.onZoomChange(-themeWhiteboardTokens.zoomStep)} />
        <button
          type="button"
          aria-label={`${Math.round(props.viewport.zoom * 100)}%`}
          onClick={props.onResetView}
          className="min-w-[var(--vlaina-size-56px)] cursor-pointer px-1 text-center text-[var(--vlaina-font-125)] font-semibold tabular-nums text-[var(--vlaina-color-text-secondary)]"
        >
          {Math.round(props.viewport.zoom * 100)}%
        </button>
        <ToolbarButton icon="common.add" label={t('whiteboard.zoomIn')} onClick={() => props.onZoomChange(themeWhiteboardTokens.zoomStep)} />
        <ToolbarButton icon="nav.fullscreen" label={t('whiteboard.fitView')} onClick={props.onFitView} />
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-4 z-[var(--vlaina-z-20)] flex flex-col items-center gap-2">
        {colorTool || sizeTool || props.selectedNoteColor ? (
          <div className={cn('pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-[var(--vlaina-radius-pill)] px-2 py-1.5', floatingPanelClassName)}>
            {colorTool ? (
              <ToolbarGroup>
                {themeWhiteboardTokens.brushColorSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={props.brushColors[colorTool] === color}
                    onClick={() => props.onBrushColorChange(colorTool, color)}
                    className={cn(
                      'size-[var(--vlaina-size-24px)] shrink-0 rounded-[var(--vlaina-radius-circle)] border transition-transform',
                      props.brushColors[colorTool] === color
                        ? 'border-[var(--vlaina-color-whiteboard-selected)] scale-[var(--vlaina-scale-110)] shadow-[var(--vlaina-shadow-selection-soft)]'
                        : 'border-[var(--vlaina-color-subtle-border-strong)] hover:scale-[var(--vlaina-scale-105)]',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </ToolbarGroup>
            ) : null}
            {colorTool && sizeTool ? <span className="h-5 w-px bg-[var(--vlaina-color-toolbar-border)]" /> : null}
            {sizeTool ? (
              <ToolbarGroup>
                <ToolbarButton icon="common.remove" label={t('whiteboard.decreaseBrushSize')} onClick={() => props.onBrushSizeChange(sizeTool, themeWhiteboardTokens.brushWheelButtonDelta)} />
                <span className="min-w-[var(--vlaina-size-48px)] text-center text-[var(--vlaina-font-125)] font-semibold tabular-nums text-[var(--vlaina-color-text-secondary)]">
                  {Math.round(props.brushSizes[sizeTool] * 100)}%
                </span>
                <ToolbarButton icon="common.add" label={t('whiteboard.increaseBrushSize')} onClick={() => props.onBrushSizeChange(sizeTool, -themeWhiteboardTokens.brushWheelButtonDelta)} />
              </ToolbarGroup>
            ) : null}
            {props.selectedNoteColor ? (
              <ToolbarGroup>
                {themeWhiteboardTokens.noteColorSwatches.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    aria-label={swatch.id}
                    aria-pressed={props.selectedNoteColor === swatch.id}
                    onClick={() => props.onNoteColorChange(swatch.id)}
                    className={cn(
                      'size-[var(--vlaina-size-24px)] shrink-0 rounded-[var(--vlaina-radius-8px)] border transition-transform',
                      props.selectedNoteColor === swatch.id
                        ? 'border-[var(--vlaina-color-whiteboard-selected)] scale-[var(--vlaina-scale-110)] shadow-[var(--vlaina-shadow-selection-soft)]'
                        : 'border-[var(--vlaina-color-subtle-border-strong)] hover:scale-[var(--vlaina-scale-105)]',
                    )}
                    style={{ backgroundColor: swatch.color }}
                  />
                ))}
              </ToolbarGroup>
            ) : null}
          </div>
        ) : null}

        <div className={cn('pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--vlaina-radius-16px)] p-1.5', floatingPanelClassName)}>
          {WHITEBOARD_TOOL_GROUPS.map((group, groupIndex) => (
            <ToolbarGroup key={groupIndex} className={cn(groupIndex > 0 && 'border-l border-[var(--vlaina-color-toolbar-border)] pl-1')}>
              {group.map((item) => (
                <ToolbarButton
                  key={item.id}
                  active={props.tool === item.id}
                  icon={item.icon}
                  indicatorColor={isDrawingTool(item.id) ? props.brushColors[item.id] : undefined}
                  label={t(item.labelKey)}
                  large
                  onClick={() => props.onToolChange(item.id)}
                />
              ))}
            </ToolbarGroup>
          ))}
        </div>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
    </>
  );
});
