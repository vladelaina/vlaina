import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_SELECTION_RESULT_TOO_LARGE_MESSAGE,
  AI_SELECTION_TOO_LARGE_MESSAGE,
  MAX_AI_SELECTION_EDIT_CHARS,
} from './selectionLimits';

const mockAddToast = vi.fn();
const mockSendMessageWithEndpointFallback = vi.fn();
const mockGetSerializedSelectionText = vi.fn(() => 'Selected text');
const mockGetSerializedSelectionContext = vi.fn(() => ({
  beforeContext: '',
  afterContext: '',
}));
const mockHasSelectedBlocks = vi.fn(() => false);

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: {
    getState: () => ({
      data: {
        ai: {
          selectedModelId: 'model-1',
          models: [{
            id: 'model-1',
            apiModelId: 'model-1',
            name: 'Model 1',
            providerId: 'provider-1',
            enabled: true,
            createdAt: 1,
          }],
          providers: [{
            id: 'provider-1',
            name: 'Provider 1',
            type: 'newapi',
            apiHost: 'https://example.invalid',
            apiKey: 'test-key',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          }],
        },
      },
    }),
  },
}));

vi.mock('@/hooks/chatService/sendMessageWithEndpointFallback', () => ({
  sendMessageWithEndpointFallback: (...args: unknown[]) => mockSendMessageWithEndpointFallback(...args),
}));

vi.mock('../../cursor/blockSelectionPluginState', () => ({
  hasSelectedBlocks: (...args: unknown[]) => mockHasSelectedBlocks(...args),
}));

vi.mock('./selectionEditing', () => ({
  getSerializedSelectionText: (...args: unknown[]) => mockGetSerializedSelectionText(...args),
  getSerializedSelectionContext: (...args: unknown[]) => mockGetSerializedSelectionContext(...args),
}));

import { createAiSelectionSuggestionResult } from './selectionRequest';

function createView(from: number, to: number) {
  return {
    state: {
      selection: { from, to },
    },
  };
}

describe('selectionRequest', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
    mockSendMessageWithEndpointFallback.mockReset();
    mockSendMessageWithEndpointFallback.mockResolvedValue('Updated text');
    mockGetSerializedSelectionText.mockClear();
    mockGetSerializedSelectionText.mockReturnValue('Selected text');
    mockGetSerializedSelectionContext.mockClear();
    mockGetSerializedSelectionContext.mockReturnValue({
      beforeContext: '',
      afterContext: '',
    });
    mockHasSelectedBlocks.mockClear();
    mockHasSelectedBlocks.mockReturnValue(false);
  });

  it('does not serialize or send oversized text selections', async () => {
    const result = await createAiSelectionSuggestionResult(
      createView(1, MAX_AI_SELECTION_EDIT_CHARS + 2) as never,
      'Edit the selected text.'
    );

    expect(result).toEqual({
      suggestion: null,
      errorMessage: AI_SELECTION_TOO_LARGE_MESSAGE,
    });
    expect(mockGetSerializedSelectionText).not.toHaveBeenCalled();
    expect(mockSendMessageWithEndpointFallback).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(AI_SELECTION_TOO_LARGE_MESSAGE, 'warning');
  });

  it('does not build suggestions from oversized model output', async () => {
    mockSendMessageWithEndpointFallback.mockResolvedValueOnce(
      'x'.repeat(MAX_AI_SELECTION_EDIT_CHARS + 1)
    );

    const result = await createAiSelectionSuggestionResult(
      createView(1, 14) as never,
      'Edit the selected text.',
      undefined,
      undefined,
      { suppressToast: true }
    );

    expect(result).toEqual({
      suggestion: null,
      errorMessage: AI_SELECTION_RESULT_TOO_LARGE_MESSAGE,
      errorType: undefined,
      errorCode: undefined,
    });
    expect(mockSendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
