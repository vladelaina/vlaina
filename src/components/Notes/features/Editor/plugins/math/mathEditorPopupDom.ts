import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';

export interface MathEditorElements {
  card: HTMLElement;
  content: HTMLElement;
  textarea: HTMLTextAreaElement;
  actions: HTMLElement;
  cancelButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
}

export function createMathEditorElements(): MathEditorElements {
  const card = document.createElement('div');
  card.className = 'math-editor-card';

  const body = document.createElement('div');
  body.className = 'math-editor-body';

  const content = document.createElement('div');
  content.className = 'math-editor-content';

  const textarea = document.createElement('textarea');
  textarea.className = 'math-editor-textarea';
  textarea.placeholder = 'Enter LaTeX...';

  const actions = document.createElement('div');
  actions.className = 'math-editor-footer';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'vlaina-icon-shadow-button math-editor-icon-action math-editor-icon-action-secondary';
  cancelButton.setAttribute('aria-label', 'Cancel');
  cancelButton.innerHTML = EDITOR_ICONS.reviewClose;

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'vlaina-icon-shadow-button math-editor-icon-action math-editor-icon-action-primary';
  saveButton.setAttribute('aria-label', 'Apply');
  saveButton.innerHTML = EDITOR_ICONS.reviewApply;

  content.append(textarea);
  actions.append(cancelButton, saveButton);
  body.append(content, actions);
  card.append(body);

  return { card, content, textarea, actions, cancelButton, saveButton };
}
