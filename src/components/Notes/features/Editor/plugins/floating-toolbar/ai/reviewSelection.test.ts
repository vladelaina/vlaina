import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TEXT_SELECTION_OVERLAY_DECORATIONS,
} from '../../selection/textSelectionOverlayPlugin';
import { floatingToolbarKey } from '../floatingToolbarKey';
import { getAiReviewSelectionDecorations } from './reviewSelection';

describe('reviewSelection', () => {
  it('stops scanning review selections after the decoration budget is reached', () => {
    const nodesBetween = vi.fn((_from, _to, callback) => {
      for (let index = 0; index < MAX_TEXT_SELECTION_OVERLAY_DECORATIONS + 10; index += 1) {
        const keepGoing = callback(
          {
            isText: true,
            text: 'x',
          },
          index
        );
        if (keepGoing === false) {
          break;
        }
      }
    });
    vi.spyOn(floatingToolbarKey, 'getState').mockReturnValue({
      aiReviews: [
        {
          requestKey: 'review-1',
          instruction: 'Edit',
          commandId: null,
          toneId: null,
          from: 0,
          to: MAX_TEXT_SELECTION_OVERLAY_DECORATIONS + 10,
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

    getAiReviewSelectionDecorations({
      doc: {
        content: { size: MAX_TEXT_SELECTION_OVERLAY_DECORATIONS + 10 },
        nodesBetween,
        forEach: () => {},
      },
    } as never);

    expect(nodesBetween).toHaveBeenCalledTimes(1);
  });
});
