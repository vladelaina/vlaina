import type { EditorView } from '@milkdown/kit/prose/view';
import { useToastStore } from '@/stores/useToastStore';
import { floatingToolbarKey } from '../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type AiReviewState } from '../types';
import {
  createAiSelectionSuggestion,
  getSerializedSelectionText,
} from './selectionCommands';

export function openAiSelectionReview(view: EditorView): boolean {
  const { from, to } = view.state.selection;
  if (from >= to) {
    useToastStore.getState().addToast('Please select some text first.', 'warning');
    return false;
  }

  const originalText = getSerializedSelectionText(view);
  if (originalText.trim().length === 0) {
    useToastStore.getState().addToast('The current selection cannot be edited by AI.', 'warning');
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        dragPosition: null,
        aiReview: {
          instruction: null,
          commandId: null,
          toneId: null,
          customPrompt: '',
          from,
          to,
          originalText,
          suggestedText: '',
          isLoading: true,
        },
      },
    })
  );
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        dragPosition: null,
        aiReview: {
          instruction: null,
          commandId: null,
          toneId: null,
          customPrompt: '',
          from,
          to,
          originalText,
          suggestedText: '',
          isLoading: false,
        },
      },
    })
  );
  return true;
}

function buildInstruction(baseInstruction: string | null, customPrompt: string): string | null {
  const trimmedBaseInstruction = baseInstruction?.trim() ?? '';
  const trimmedCustomPrompt = customPrompt.trim();

  if (trimmedBaseInstruction && trimmedCustomPrompt) {
    return `${trimmedBaseInstruction}\n\nAdditional requirement: ${trimmedCustomPrompt}`;
  }

  if (trimmedBaseInstruction) {
    return trimmedBaseInstruction;
  }

  if (trimmedCustomPrompt) {
    return trimmedCustomPrompt;
  }

  return null;
}

export function updateAiSelectionReviewPrompt(
  view: EditorView,
  review: AiReviewState,
  customPrompt: string
) {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...review,
          customPrompt,
        },
      },
    })
  );
}

export async function runAiSelectionReviewPrompt(
  view: EditorView,
  review: AiReviewState
): Promise<boolean> {
  const instruction = buildInstruction(null, review.customPrompt);
  if (!instruction) {
    useToastStore.getState().addToast('Please enter an AI instruction first.', 'warning');
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...review,
          instruction,
          commandId: null,
          toneId: null,
          suggestedText: '',
          isLoading: true,
        },
      },
    })
  );

  const reviewSelection = {
    from: review.from,
    to: review.to,
    originalText: review.originalText,
  };
  const suggestion = await createAiSelectionSuggestion(
    view,
    instruction,
    review.customPrompt,
    reviewSelection
  );
  if (!suggestion) {
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
        payload: {
          aiReview: {
            ...review,
            instruction,
            commandId: null,
            toneId: null,
            isLoading: false,
          },
        },
      })
    );
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...suggestion,
          commandId: null,
          toneId: null,
          isLoading: false,
        },
      },
    })
  );
  return true;
}

export async function runAiSelectionReviewCommand(
  view: EditorView,
  review: AiReviewState,
  command: {
    id: string;
    instruction: string;
    toneId?: string | null;
  }
): Promise<boolean> {
  const instruction = buildInstruction(command.instruction, review.customPrompt);
  if (!instruction) {
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...review,
          instruction,
          commandId: command.id,
          toneId: command.toneId ?? null,
          suggestedText: '',
          isLoading: true,
        },
      },
    })
  );

  const reviewSelection = {
    from: review.from,
    to: review.to,
    originalText: review.originalText,
  };
  const suggestion = await createAiSelectionSuggestion(
    view,
    instruction,
    review.customPrompt,
    reviewSelection
  );
  if (!suggestion) {
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
        payload: {
          aiReview: {
            ...review,
            instruction,
            commandId: command.id,
            toneId: command.toneId ?? null,
            isLoading: false,
          },
        },
      })
    );
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...suggestion,
          commandId: command.id,
          toneId: command.toneId ?? null,
          isLoading: false,
        },
      },
    })
  );
  return true;
}
