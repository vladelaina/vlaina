import { memo, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardElement, WhiteboardTool } from '../../model/whiteboardModel';

interface WhiteboardElementNodeProps {
  element: WhiteboardElement;
  erasing?: boolean;
  selected: boolean;
  showSelectionBorder: boolean;
  tool: WhiteboardTool;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
}

export const WhiteboardElementNode = memo(function WhiteboardElementNode({
  element,
  erasing = false,
  selected,
  showSelectionBorder,
  tool,
  onPointerDown,
}: WhiteboardElementNodeProps) {
  return (
    <div
      data-whiteboard-element="true"
      aria-label={element.text}
      className={cn(
        'absolute select-none overflow-hidden rounded-[var(--vlaina-radius-8px)] border bg-[var(--vlaina-color-whiteboard-element)] shadow-[var(--vlaina-shadow-whiteboard-element)]',
        tool === 'select' ? selected ? 'cursor-grab' : 'cursor-move' : 'pointer-events-none',
      )}
      onPointerDown={(event) => onPointerDown(event, element)}
      style={{
        borderColor: showSelectionBorder
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
    </div>
  );
});
