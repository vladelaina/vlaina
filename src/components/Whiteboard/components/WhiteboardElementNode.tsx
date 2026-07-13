import { memo, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import type { WhiteboardElement, WhiteboardNoteColor, WhiteboardTool } from '../model/whiteboardModel';

const noteBackgrounds: Record<WhiteboardNoteColor, string> = {
  yellow: 'var(--vlaina-color-whiteboard-note-yellow)',
  blue: 'var(--vlaina-color-whiteboard-note-blue)',
  green: 'var(--vlaina-color-whiteboard-note-green)',
  pink: 'var(--vlaina-color-whiteboard-note-pink)',
  purple: 'var(--vlaina-color-whiteboard-note-purple)',
  gray: 'var(--vlaina-color-whiteboard-note-gray)',
};

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
  onTextEditEnd: (id: string) => void;
  onTextEditStart: (id: string) => void;
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
  onTextEditEnd,
  onTextEditStart,
  onTextChange,
}: WhiteboardElementNodeProps) {
  const isNote = element.type === 'note';
  const isEllipse = element.type === 'ellipse';
  const isImage = element.type === 'image';
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const restoreFocusOnWindowFocusRef = useRef(false);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (!restoreFocusOnWindowFocusRef.current) return;
      restoreFocusOnWindowFocusRef.current = false;
      textAreaRef.current?.focus();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  useEffect(() => {
    if (isNote && selected && element.text.length === 0) textAreaRef.current?.focus();
  }, [element.text.length, isNote, selected]);

  const handleTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Escape' && !(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.blur();
  };

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
        background: isImage ? 'var(--vlaina-color-whiteboard-element)' : isNote ? noteBackgrounds[element.noteColor ?? 'yellow'] : 'var(--vlaina-color-whiteboard-shape)',
        borderColor: selected || connectorSource
          ? 'var(--vlaina-color-whiteboard-selected)'
          : isNote
            ? 'var(--vlaina-color-subtle-border-strong)'
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
        <div className="h-[var(--vlaina-size-28px)] shrink-0 rounded-t-[var(--vlaina-radius-8px)] border-b border-[var(--vlaina-color-subtle-border-strong)]" />
      ) : null}
      {isImage && element.imageSrc ? (
        <img alt={element.text} draggable={false} src={element.imageSrc} className="size-full object-cover" />
      ) : (
        <textarea
          ref={textAreaRef}
          aria-label={elementTextLabel}
          spellCheck={false}
          value={element.text}
          onChange={(event) => onTextChange(element.id, event.target.value)}
          onBlur={() => {
            if (!document.hasFocus()) {
              restoreFocusOnWindowFocusRef.current = true;
              return;
            }
            onTextEditEnd(element.id);
          }}
          onFocus={() => {
            onSelect(element.id);
            onTextEditStart(element.id);
          }}
          onKeyDown={handleTextKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'min-h-0 w-full resize-none bg-transparent text-center text-[var(--vlaina-font-15)] font-medium leading-[var(--vlaina-leading-15)] outline-none placeholder:text-[var(--vlaina-color-text-soft)]',
            isNote ? 'flex-1 px-4 pb-4 pt-2 text-left' : 'h-full px-5 py-6',
            isEllipse && 'rounded-[var(--vlaina-radius-circle)]',
            !isNote && !selected && 'pointer-events-none',
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
