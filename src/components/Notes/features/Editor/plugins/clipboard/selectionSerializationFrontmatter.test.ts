import { describe, expect, it, vi } from 'vitest';

import { serializeSelectionToClipboardText } from './selectionSerialization';
import {
  getFrontmatterFenceLanguage,
  getFrontmatterFenceMeta,
} from '../frontmatter/frontmatterMarkdown';

describe('selectionSerialization frontmatter', () => {
  it('serializes leading frontmatter back to markdown fences', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(
      () => `\`\`\`${getFrontmatterFenceLanguage()} ${getFrontmatterFenceMeta()}\ntitle: demo\nsummary: test\n\`\`\`\n\nBody\n`
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
