import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  WHITEBOARD_DRAWING_TOOLS,
  WHITEBOARD_ERASER_TOOLS,
  isDrawingTool,
  type WhiteboardBrushColors,
  type WhiteboardBrushSizes,
  type WhiteboardBrushTool,
  type WhiteboardDrawingTool,
  type WhiteboardTool,
} from '../../model/whiteboardModel';
import {
  WhiteboardToolbarButton,
  WhiteboardToolbarGroup,
  whiteboardFloatingPanelClassName,
} from './WhiteboardToolbarPrimitives';
import { WhiteboardColorPicker } from './WhiteboardColorPicker';

export type WhiteboardToolPanelName = 'brush' | 'eraser';

interface WhiteboardToolPanelProps {
  brushColors: WhiteboardBrushColors;
  brushSizes: WhiteboardBrushSizes;
  panel: WhiteboardToolPanelName;
  tool: WhiteboardTool;
  onBrushColorChange: (tool: WhiteboardDrawingTool, color: string) => void;
  onBrushSizeSelect: (tool: WhiteboardBrushTool, size: number) => void;
  onToolChange: (tool: WhiteboardTool) => void;
}

export function WhiteboardToolPanel(props: WhiteboardToolPanelProps) {
  const { t } = useI18n();
  const drawingTool = isDrawingTool(props.tool) ? props.tool : 'pen';
  const sizeTool = props.tool === 'stroke-eraser' ? props.tool : drawingTool;
  const tools = props.panel === 'brush' ? WHITEBOARD_DRAWING_TOOLS : WHITEBOARD_ERASER_TOOLS;

  return (
    <div
      data-whiteboard-tool-panel="true"
      className={cn(
        'flex max-w-full items-center gap-3 overflow-x-auto rounded-[var(--vlaina-radius-16px)] px-2 py-1.5',
        whiteboardFloatingPanelClassName,
      )}
    >
      <WhiteboardToolbarGroup>
        {tools.map((item) => (
          <WhiteboardToolbarButton
            key={item.id}
            active={props.tool === item.id}
            icon={item.icon}
            indicatorColor={isDrawingTool(item.id) ? props.brushColors[item.id] : undefined}
            label={t(item.labelKey)}
            onClick={() => props.onToolChange(item.id)}
          />
        ))}
      </WhiteboardToolbarGroup>

      {props.panel === 'brush' ? (
        <>
          <PanelDivider />
          <ColorChoices colors={props.brushColors} tool={drawingTool} onChange={props.onBrushColorChange} />
          <PanelDivider />
          <SizeChoices sizes={props.brushSizes} tool={sizeTool} onChange={props.onBrushSizeSelect} />
        </>
      ) : null}

      {props.panel === 'eraser' && props.tool === 'stroke-eraser' ? (
        <>
          <PanelDivider />
          <SizeChoices sizes={props.brushSizes} tool="stroke-eraser" onChange={props.onBrushSizeSelect} />
        </>
      ) : null}

    </div>
  );
}

function ColorChoices({ colors, tool, onChange }: {
  colors: WhiteboardBrushColors;
  tool: WhiteboardDrawingTool;
  onChange: (tool: WhiteboardDrawingTool, color: string) => void;
}) {
  return (
    <WhiteboardToolbarGroup>
      {themeWhiteboardTokens.brushColorSwatches.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={colors[tool] === color}
          onClick={() => onChange(tool, color)}
          className={cn(
            'size-[var(--vlaina-size-24px)] shrink-0 rounded-[var(--vlaina-radius-circle)] border transition-transform',
            colors[tool] === color
              ? 'border-[var(--vlaina-color-whiteboard-selected)] scale-[var(--vlaina-scale-110)] shadow-[var(--vlaina-shadow-selection-soft)]'
              : 'border-[var(--vlaina-color-subtle-border-strong)] hover:scale-[var(--vlaina-scale-105)]',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <WhiteboardColorPicker color={colors[tool]} onChange={(color) => onChange(tool, color)} />
    </WhiteboardToolbarGroup>
  );
}

function SizeChoices({ sizes, tool, onChange }: {
  sizes: WhiteboardBrushSizes;
  tool: WhiteboardBrushTool;
  onChange: (tool: WhiteboardBrushTool, size: number) => void;
}) {
  const { t } = useI18n();
  return (
    <WhiteboardToolbarGroup>
      {themeWhiteboardTokens.brushSizePresets.map((size) => (
        <button
          key={size}
          type="button"
          aria-label={`${t('whiteboard.brushSize')} ${Math.round(size * 100)}%`}
          aria-pressed={sizes[tool] === size}
          onClick={() => onChange(tool, size)}
          className={cn(
            'flex size-[var(--vlaina-size-28px)] shrink-0 items-center justify-center rounded-[var(--vlaina-radius-circle)] border transition-colors',
            sizes[tool] === size
              ? 'border-[var(--vlaina-color-whiteboard-selected)] bg-[var(--vlaina-accent-light)]'
              : 'border-transparent hover:bg-[var(--vlaina-color-control-hover-bg)]',
          )}
        >
          <span
            data-whiteboard-size-preview={size}
            aria-hidden="true"
            className="rounded-[var(--vlaina-radius-circle)] bg-[var(--vlaina-color-text-primary)]"
            style={{ height: size * themeWhiteboardTokens.brushSizePreviewBasePx, width: size * themeWhiteboardTokens.brushSizePreviewBasePx }}
          />
        </button>
      ))}
    </WhiteboardToolbarGroup>
  );
}

function PanelDivider() {
  return <span className="h-6 w-px shrink-0 bg-[var(--vlaina-color-toolbar-border)]" />;
}
