import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useImageNodeState } from './useImageNodeState';

function createImageNode(attrs: Record<string, unknown>) {
  return { attrs };
}

describe('useImageNodeState', () => {
  it('syncs the caption input when the backing image alt changes', async () => {
    const { result, rerender } = renderHook(
      ({ node }) => useImageNodeState(node),
      {
        initialProps: {
          node: createImageNode({
            src: './assets/upper.png',
            alt: 'Upper image',
            align: 'center',
            width: null,
            crop: null,
          }),
        },
      },
    );

    expect(result.current.captionInput).toBe('Upper image');

    rerender({
      node: createImageNode({
        src: './assets/lower.png',
        alt: 'Lower image',
        align: 'center',
        width: null,
        crop: null,
      }),
    });

    await waitFor(() => {
      expect(result.current.captionInput).toBe('Lower image');
    });
  });
});
