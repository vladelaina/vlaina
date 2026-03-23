import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import type { MathRenderErrorDetails } from './katex';

export interface MathEditorElements {
  card: HTMLElement;
  content: HTMLElement;
  textarea: HTMLTextAreaElement;
  preview: HTMLElement;
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

  const preview = document.createElement('div');
  preview.className = 'math-editor-preview';

  const actions = document.createElement('div');
  actions.className = 'math-editor-footer';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'ai-review-action tertiary ai-review-icon-action neko-icon-shadow-button math-editor-icon-action';
  cancelButton.setAttribute('aria-label', 'Cancel');
  cancelButton.innerHTML = EDITOR_ICONS.reviewClose;

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'ai-review-action primary ai-review-icon-action neko-icon-shadow-button math-editor-icon-action';
  saveButton.setAttribute('aria-label', 'Apply');
  saveButton.innerHTML = EDITOR_ICONS.reviewApply;

  content.append(preview, textarea);
  actions.append(cancelButton, saveButton);
  body.append(content, actions);
  card.append(body);

  return { card, content, textarea, preview, actions, cancelButton, saveButton };
}

export function renderMathEditorPreview(args: {
  preview: HTMLElement;
  html: string;
  error: string | null;
  errorDetails: MathRenderErrorDetails | null;
  displayMode: boolean;
}) {
  const { preview, html, error, errorDetails, displayMode } = args;
  preview.innerHTML = '';

  const content = document.createElement('div');
  content.className = `math-editor-preview-content${displayMode ? ' display-mode' : ''}`;
  content.innerHTML = html;
  preview.appendChild(content);

  if (!error) {
    return;
  }

  const errorElement = document.createElement('div');
  errorElement.className = 'math-editor-error';
  const summaryElement = document.createElement('div');
  summaryElement.className = 'math-editor-error-summary';
  summaryElement.textContent = errorDetails?.summary ?? error;
  errorElement.appendChild(summaryElement);

  if (errorDetails?.locationLabel) {
    const locationElement = document.createElement('div');
    locationElement.className = 'math-editor-error-location';
    locationElement.textContent = errorDetails.locationLabel;
    errorElement.appendChild(locationElement);
  }

  if (errorDetails?.context && errorDetails.pointer) {
    const contextElement = document.createElement('pre');
    contextElement.className = 'math-editor-error-context';
    contextElement.textContent = `${errorDetails.context}\n${errorDetails.pointer}`;
    errorElement.appendChild(contextElement);
  }

  if (errorDetails?.rawMessage && errorDetails.rawMessage !== errorDetails.summary) {
    const rawElement = document.createElement('div');
    rawElement.className = 'math-editor-error-raw';
    rawElement.textContent = errorDetails.rawMessage;
    errorElement.appendChild(rawElement);
  }

  preview.appendChild(errorElement);
}
