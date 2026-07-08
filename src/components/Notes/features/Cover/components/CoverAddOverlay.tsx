interface CoverAddOverlayProps {
  visible: boolean;
  onAddCover: () => void;
}

export function CoverAddOverlay({ visible, onAddCover }: CoverAddOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 top-0 h-20 w-full z-[var(--vlaina-z-20)] cursor-pointer hover:bg-[var(--vlaina-color-hover-overlay-soft)] transition-colors pointer-events-auto"
      data-no-editor-drag-box="true"
      data-note-cover-add-overlay="true"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAddCover();
      }}
    />
  );
}
