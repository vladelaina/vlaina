interface CoverAddOverlayProps {
  visible: boolean;
  onAddCover: () => void;
}

export function CoverAddOverlay({ visible, onAddCover }: CoverAddOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 h-20 cursor-pointer hover:bg-[var(--neko-hover)]/30 transition-colors pointer-events-auto"
      onClick={onAddCover}
    />
  );
}
