import type { EditorView } from '@milkdown/kit/prose/view';
import { logAiSelectionDebug } from '../../ai/debug';
import { openAiSelectionReview, runAiSelectionReviewCommand } from '../../ai/reviewFlow';
import { createAiReviewState } from '../../ai/reviewState';
import { recordAiMenuItemUsage } from './usageRanking';

function setActiveCategory(dropdown: HTMLElement, categoryId: string) {
  const currentActiveCategory = dropdown.querySelector<HTMLElement>('[data-ai-category].active')?.dataset.aiCategory;
  if (currentActiveCategory === categoryId) {
    return;
  }

  dropdown.querySelectorAll<HTMLElement>('[data-ai-category]').forEach((button) => {
    button.classList.toggle('active', button.dataset.aiCategory === categoryId);
  });

  dropdown.querySelectorAll<HTMLElement>('[data-ai-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.aiPanel === categoryId);
  });

  dropdown.dispatchEvent(
    new CustomEvent('ai-dropdown:category-change', {
      bubbles: false,
      detail: { categoryId },
    })
  );
}

function bindCategoryNavigation(dropdown: HTMLElement) {
  dropdown.querySelectorAll<HTMLElement>('[data-ai-category]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('mouseenter', () => {
      const categoryId = button.dataset.aiCategory;
      if (!categoryId) {
        return;
      }

      setActiveCategory(dropdown, categoryId);
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const categoryId = button.dataset.aiCategory;
      if (!categoryId) {
        return;
      }

      setActiveCategory(dropdown, categoryId);
    });
  });
}

function bindCommandExecution(dropdown: HTMLElement, view: EditorView) {
  dropdown.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((button) => {
    let isSubmitting = false;

    button.addEventListener('mousedown', (event) => {
      logAiSelectionDebug('dropdown:mousedown', {
        prompt: button.dataset.aiPrompt ?? '',
      });
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const prompt = button.dataset.aiPrompt ?? '';
      const commandId = button.dataset.aiCommandId ?? '';
      const toneId = button.dataset.aiToneId ?? '';
      const groupId = button.dataset.aiGroupId ?? '';
      if (isSubmitting) {
        logAiSelectionDebug('dropdown:click-ignored-submitting', {
          prompt,
        });
        return;
      }

      logAiSelectionDebug('dropdown:click', {
        prompt,
        commandId,
        toneId,
        selectionFrom: view.state.selection.from,
        selectionTo: view.state.selection.to,
      });

      isSubmitting = true;
      button.disabled = true;

      const review = createAiReviewState(view, prompt, commandId, toneId);
      if (!openAiSelectionReview(view, review.requestKey)) {
        isSubmitting = false;
        button.disabled = false;
        return;
      }

      recordAiMenuItemUsage(groupId, commandId);

      void runAiSelectionReviewCommand(view, review, {
        id: commandId,
        instruction: prompt,
        toneId: toneId || null,
      })
        .then((applied) => {
          logAiSelectionDebug('dropdown:complete', {
            prompt,
            commandId,
            toneId,
            applied,
          });
        })
        .finally(() => {
          isSubmitting = false;
          button.disabled = false;
        });
    });
  });
}

export function bindAiDropdownInteractions(dropdown: HTMLElement, view: EditorView) {
  bindCategoryNavigation(dropdown);
  bindCommandExecution(dropdown, view);
}
