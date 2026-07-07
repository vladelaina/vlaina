import { memo, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import type { WhiteboardElement, WhiteboardTool } from '../model/whiteboardModel';

interface WhiteboardElementNodeProps {
  connectorSource: boolean;
  element: WhiteboardElement;
  elementTextLabel: string;
  resizeLabel: string;
  selected: boolean;
  tool: WhiteboardTool;
  onConnectorTarget: (id: string) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => void;
  onSelect: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
}

export const WhiteboardElementNode = memo(function WhiteboardElementNode({
  connectorSource,
  element,
  elementTextLabel,
  resizeLabel,
  selected,
  tool,
  onConnectorTarget,
  onPointerDown,
  onResizePointerDown,
  onSelect,
  onTextChange,
}: WhiteboardElementNodeProps) {
  const isNote = element.type === 'note';
  const isEllipse = element.type === 'ellipse';
  const isImage = element.type === 'image';

  return (
    <div
      data-whiteboard-element="true"
      aria-label={element.text || element.type}
      className={cn(
        'absolute flex select-none flex-col border text-[var(--vlaina-color-text-primary)] shadow-[var(--vlaina-shadow-whiteboard-element)]',
        isNote ? 'rounded-[var(--vlaina-radius-8px)]' : 'items-center justify-center',
        isEllipse ? 'rounded-[var(--vlaina-radius-circle)]' : 'rounded-[var(--vlaina-radius-8px)]',
        isImage && 'overflow-hidden bg-[var(--vlaina-color-whiteboard-element)]',
        tool === 'connector' ? 'cursor-crosshair' : 'cursor-move',
      )}
      onPointerDown={(event) => onPointerDown(event, element)}
      onClick={(event) => {
        if (tool !== 'connector') return;
        event.stopPropagation();
        onConnectorTarget(element.id);
      }}
      style={{
        background: isImage ? 'var(--vlaina-color-whiteboard-element)' : isNote ? 'var(--vlaina-color-whiteboard-note)' : 'var(--vlaina-color-whiteboard-shape)',
        borderColor: selected || connectorSource
          ? 'var(--vlaina-color-whiteboard-selected)'
          : isNote
            ? 'var(--vlaina-color-whiteboard-note-border)'
            : 'var(--vlaina-color-whiteboard-shape-border)',
        height: element.height,
        left: element.x,
        outline: connectorSource ? 'var(--vlaina-size-2px) solid var(--vlaina-color-whiteboard-selected)' : undefined,
        outlineOffset: connectorSource ? 'var(--vlaina-size-4px)' : undefined,
        top: element.y,
        width: element.width,
      }}
    >
      {isNote ? (
        <div className="h-[var(--vlaina-size-28px)] shrink-0 rounded-t-[var(--vlaina-radius-8px)] bg-[var(--vlaina-color-whiteboard-element)]" />
      ) : null}
      {isImage && element.imageSrc ? (
        <img alt={element.text} draggable={false} src={element.imageSrc} className="size-full object-cover" />
      ) : (
        <textarea
          aria-label={elementTextLabel}
          spellCheck={false}
          value={element.text}
          onChange={(event) => onTextChange(element.id, event.target.value)}
          onFocus={() => onSelect(element.id)}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'min-h-0 w-full resize-none bg-transparent text-center text-[var(--vlaina-font-15)] font-medium leading-[var(--vlaina-leading-15)] outline-none placeholder:text-[var(--vlaina-color-text-soft)]',
            isNote ? 'flex-1 px-4 pb-4 pt-2 text-left' : 'h-full px-5 py-6',
            isEllipse && 'rounded-[var(--vlaina-radius-circle)]',
          )}
        />
      )}
      {tool === 'select' ? (
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
