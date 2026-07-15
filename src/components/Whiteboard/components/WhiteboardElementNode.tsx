import { memo, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardElement, WhiteboardTool } from '../model/whiteboardModel';

interface WhiteboardElementNodeProps {
  element: WhiteboardElement;
  erasing?: boolean;
  resizeLabel: string;
  selected: boolean;
  tool: WhiteboardTool;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => void;
}

export const WhiteboardElementNode = memo(function WhiteboardElementNode({
  element,
  erasing = false,
  resizeLabel,
  selected,
  tool,
  onPointerDown,
  onResizePointerDown,
}: WhiteboardElementNodeProps) {
  return (
    <div
      data-whiteboard-element="true"
      aria-label={element.text}
      className={cn(
        'absolute select-none overflow-hidden rounded-[var(--vlaina-radius-8px)] border bg-[var(--vlaina-color-whiteboard-element)] shadow-[var(--vlaina-shadow-whiteboard-element)]',
        tool === 'select' ? 'cursor-move' : 'cursor-default',
      )}
      onPointerDown={(event) => onPointerDown(event, element)}
      style={{
        borderColor: selected
          ? 'var(--vlaina-color-whiteboard-selected)'
          : 'var(--vlaina-color-whiteboard-element-border)',
        height: element.height,
        left: element.x,
        opacity: erasing ? themeWhiteboardTokens.eraserTargetPreviewOpacity : undefined,
        top: element.y,
        width: element.width,
      }}
    >
      {element.imageSrc ? (
        <img alt={element.text} draggable={false} src={element.imageSrc} className="size-full object-cover" />
      ) : null}
      {tool === 'select' && selected ? (
        <button
          type="button"
          aria-label={resizeLabel}
          onPointerDown={(event) => onResizePointerDown(event, element)}
          className="absolute bottom-1 right-1 size-[var(--vlaina-size-16px)] cursor-nwse-resize rounded-[var(--vlaina-radius-4px)] border border-[var(--vlaina-color-whiteboard-selected)] bg-[var(--vlaina-color-floating-surface)] opacity-[var(--vlaina-opacity-80)]"
        />
      ) : null}
    </div>
  );
});
