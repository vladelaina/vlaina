interface CoverAddOverlayProps {
  visible: boolean;
  onAddCover: () => void;
}

export function CoverAddOverlay({ visible, onAddCover }: CoverAddOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 top-0 h-20 w-full z-30 cursor-pointer hover:bg-[var(--vlaina-hover)]/30 transition-colors pointer-events-auto"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAddCover();
      }}
    />
  );
}
