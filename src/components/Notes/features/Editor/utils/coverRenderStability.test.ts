import { describe, expect, it } from 'vitest';
import {
  canKeepCoverDuringEditorReload,
  getStableCoverSignature,
} from './coverRenderStability';

describe('cover render stability', () => {
  const notesRootPath = '/notesRoot';

  it('keeps the same cover mounted while the editor reloads after a non-cover disk update', () => {
    const cover = {
      url: './assets/cover.webp',
      positionX: 50,
      positionY: 50,
      height: 279,
      scale: 1,
    };
    const coverSignature = getStableCoverSignature({
      ...cover,
    });

    expect(canKeepCoverDuringEditorReload({
      hasActiveNote: true,
      isEditorViewReady: false,
      coverUrl: './assets/cover.webp',
      currentNotePath: 'test.md',
      coverSignature,
      lastRenderedCover: {
        notePath: 'test.md',
        coverSignature,
        cover,
        notesRootPath,
      },
    })).toBe(true);
  });

  it('does not keep the previous cover mounted when the cover itself changes', () => {
    const previousCover = {
      url: './assets/cover-a.webp',
      positionX: 50,
      positionY: 50,
      height: 279,
      scale: 1,
    };
    const previousSignature = getStableCoverSignature({
      ...previousCover,
    });
    const nextSignature = getStableCoverSignature({
      url: './assets/cover-b.webp',
      positionX: 50,
      positionY: 50,
      height: 279,
      scale: 1,
    });

    expect(canKeepCoverDuringEditorReload({
      hasActiveNote: true,
      isEditorViewReady: false,
      coverUrl: './assets/cover-b.webp',
      currentNotePath: 'test.md',
      coverSignature: nextSignature,
      lastRenderedCover: {
        notePath: 'test.md',
        coverSignature: previousSignature,
        cover: previousCover,
        notesRootPath,
      },
    })).toBe(false);
  });

  it('treats cover crop and height changes as cover changes', () => {
    const previousCover = {
      url: './assets/cover.webp',
      positionX: 50,
      positionY: 50,
      height: 279,
      scale: 1,
    };
    const previousSignature = getStableCoverSignature({
      ...previousCover,
    });
    const nextSignature = getStableCoverSignature({
      url: './assets/cover.webp',
      positionX: 60,
      positionY: 45,
      height: 320,
      scale: 1.1,
    });

    expect(canKeepCoverDuringEditorReload({
      hasActiveNote: true,
      isEditorViewReady: false,
      coverUrl: './assets/cover.webp',
      currentNotePath: 'test.md',
      coverSignature: nextSignature,
      lastRenderedCover: {
        notePath: 'test.md',
        coverSignature: previousSignature,
        cover: previousCover,
        notesRootPath,
      },
    })).toBe(false);
  });
});
