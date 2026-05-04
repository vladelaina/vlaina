import { describe, expect, it, vi } from 'vitest';

import { serializeSelectionToClipboardText } from './selectionSerialization';

describe('selectionSerialization frontmatter', () => {
  it('serializes leading frontmatter back to markdown fences', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(
      () => '```yaml-frontmatter\ntitle: demo\nsummary: test\n```\n\nBody\n'
    );
    const state: any = {
      selection: {
        from: 10,
        to: 20,
        content: () => slice,
      },
      doc: {
        slice: vi.fn(),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => ({ type: 'doc' })),
        },
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(
      '---\ntitle: demo\nsummary: test\n---\nBody'
    );
  });
});
