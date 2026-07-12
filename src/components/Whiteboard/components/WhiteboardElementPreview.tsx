import type { WhiteboardElement } from '../model/whiteboardModel';

export function WhiteboardElementPreview({ element }: { element: WhiteboardElement }) {
  const isNote = element.type === 'note';
  const isEllipse = element.type === 'ellipse';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute border border-dashed border-[var(--vlaina-color-whiteboard-selected)] opacity-[var(--vlaina-opacity-80)] shadow-[var(--vlaina-shadow-whiteboard-element)]"
      style={{
        background: isNote
          ? 'var(--vlaina-color-whiteboard-note-yellow)'
          : 'var(--vlaina-color-whiteboard-shape)',
        borderRadius: isEllipse
          ? 'var(--vlaina-radius-circle)'
          : 'var(--vlaina-radius-8px)',
        height: element.height,
        left: element.x,
        top: element.y,
        width: element.width,
      }}
    />
  );
}
