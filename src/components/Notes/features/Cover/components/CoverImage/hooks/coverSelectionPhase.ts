import type { CoverFlowPhase } from '../coverFlowPhase';

interface ResolveCoverFlowPhaseOptions {
  url: string | null;
  previewSrc: string | null;
  isError: boolean;
  isSelectionCommitting: boolean;
}

export function resolveCoverFlowPhase({
  url,
  previewSrc,
  isError,
  isSelectionCommitting,
}: ResolveCoverFlowPhaseOptions): CoverFlowPhase {
  if (isError) return 'error';
  if (!url && !previewSrc) return 'idle';
  if (isSelectionCommitting) return 'committing';
  if (previewSrc) return 'previewing';
  return 'ready';
}
