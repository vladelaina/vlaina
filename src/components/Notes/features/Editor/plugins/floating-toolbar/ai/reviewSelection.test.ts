import { describe, expect, it, vi } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import {
  MAX_TEXT_SELECTION_OVERLAY_DECORATIONS,
} from '../../selection/textSelectionOverlayPlugin';
import { floatingToolbarKey } from '../floatingToolbarKey';
import { getAiReviewSelectionDecorations } from './reviewSelection';

const SchemaCtor = (ProseModel as any).Schema;
const schema = new SchemaCtor({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
  },
});

describe('reviewSelection', () => {
  it('stops scanning review selections after the decoration budget is reached', () => {
    const doc = schema.nodes.doc.create(null, Array.from(
      { length: MAX_TEXT_SELECTION_OVERLAY_DECORATIONS + 10 },
      () => schema.nodes.paragraph.create(null, schema.text('x'))
    ));
    vi.spyOn(floatingToolbarKey, 'getState').mockReturnValue({
      aiReviews: [
        {
          requestKey: 'review-1',
          instruction: 'Edit',
          commandId: null,
          toneId: null,
          from: 0,
          to: doc.content.size,
          originalText: 'x',
          suggestedText: '',
          isLoading: true,
          errorMessage: null,
        },
        {
          requestKey: 'review-2',
          instruction: 'Edit',
          commandId: null,
          toneId: null,
          from: 0,
          to: 1,
          originalText: 'x',
          suggestedText: '',
          isLoading: true,
          errorMessage: null,
        },
      ],
    } as never);

    const decorations = getAiReviewSelectionDecorations({ doc } as never);

    expect(decorations.find()).toHaveLength(MAX_TEXT_SELECTION_OVERLAY_DECORATIONS);
  });
});
