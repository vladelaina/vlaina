export interface CoverRenderState {
  url: string | null;
  positionX: number;
  positionY: number;
  height?: number;
  scale: number;
}

export interface RenderedCoverSnapshot {
  notePath: string | undefined;
  coverSignature: string;
  cover: CoverRenderState;
  notesRootPath: string;
}

export function getStableCoverSignature(cover: CoverRenderState) {
  if (!cover.url) {
    return '';
  }

  return JSON.stringify([
    cover.url,
    cover.positionX,
    cover.positionY,
    cover.height ?? null,
    cover.scale,
  ]);
}

export function canKeepCoverDuringEditorReload({
  hasActiveNote,
  isEditorViewReady,
  coverUrl,
  currentNotePath,
  coverSignature,
  lastRenderedCover,
}: {
  hasActiveNote: boolean;
  isEditorViewReady: boolean;
  coverUrl: string | null;
  currentNotePath: string | undefined;
  coverSignature: string;
  lastRenderedCover: RenderedCoverSnapshot | null;
}) {
  return (
    hasActiveNote &&
    !isEditorViewReady &&
    Boolean(coverUrl) &&
    lastRenderedCover?.notePath === currentNotePath &&
    lastRenderedCover?.coverSignature === coverSignature
  );
}
