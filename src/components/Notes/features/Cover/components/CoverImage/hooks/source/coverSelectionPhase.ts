import type { CoverFlowPhase } from '../../coverFlowPhase';

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
  if (previewSrc && !isSelectionCommitting) return 'previewing';
  if (isError) return 'error';
  if (isSelectionCommitting) return 'committing';
  if (!url && !previewSrc) return 'idle';
  return 'ready';
}
