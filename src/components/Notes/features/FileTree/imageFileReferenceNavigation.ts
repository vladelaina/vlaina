import type { ImageFileReference } from './imageFileReferences';
import { getImageSourceBase } from '../Editor/plugins/image-block/utils/imageSourcePath';

function waitForNextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function findBodyReferenceElement(source: string): HTMLElement | null {
  const sourceBase = getImageSourceBase(source);
  const candidates = document.querySelectorAll<HTMLElement>('[data-src], img[src]');
  for (const candidate of candidates) {
    const candidateSource = candidate.getAttribute('data-src') ?? candidate.getAttribute('src') ?? '';
    if (candidateSource === source || getImageSourceBase(candidateSource) === sourceBase) {
      return candidate;
    }
  }
  return null;
}

export async function navigateToImageFileReference(
  reference: ImageFileReference,
  currentNotePath: string | null | undefined,
  openNote: (path: string) => Promise<unknown>,
) {
  if (currentNotePath !== reference.path) {
    await openNote(reference.path);
  }

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const target = reference.kind === 'cover'
      ? document.querySelector<HTMLElement>('[data-note-cover-region="true"]')
      : reference.source
        ? findBodyReferenceElement(reference.source)
        : null;
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'center' });
      target.focus({ preventScroll: true });
      return true;
    }
    await waitForNextFrame();
  }
  return false;
}
