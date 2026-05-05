export interface TextEditorPopupElements {
  card: HTMLElement;
  content: HTMLElement;
  textarea: HTMLTextAreaElement;
  actions: HTMLElement;
  cancelButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
}

export interface MountTextEditorPopupArgs {
  container: HTMLElement;
  value: string;
  placeholder?: string;
  onInput: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const POPUP_VIEWPORT_MARGIN = 12;
export const TEXT_EDITOR_POPUP_CARD_SELECTOR = '.text-editor-card';

export function createTextEditorPopupElements(
  placeholder = ''
): TextEditorPopupElements {
  const card = document.createElement('div');
  card.className = 'text-editor-card math-editor-card';

  const content = document.createElement('div');
  content.className = 'text-editor-content math-editor-content';

  const textarea = document.createElement('textarea');
  textarea.className = 'text-editor-textarea math-editor-textarea';
  textarea.placeholder = placeholder;

  const actions = document.createElement('div');
  actions.className = 'text-editor-footer math-editor-footer';

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'text-editor-actions math-editor-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className =
    'text-editor-action-button text-editor-action-button-secondary math-editor-action-button math-editor-action-button-secondary';
  cancelButton.setAttribute('aria-label', 'Cancel');
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className =
    'text-editor-action-button text-editor-action-button-primary math-editor-action-button math-editor-action-button-primary';
  saveButton.setAttribute('aria-label', 'Save');
  saveButton.textContent = 'Save';

  content.append(textarea);
  buttonGroup.append(cancelButton, saveButton);
  actions.append(buttonGroup);
  card.append(content, actions);

  return { card, content, textarea, actions, cancelButton, saveButton };
}

export function resizeTextEditorPopupTextareaToContent(args: {
  card: HTMLElement;
  textarea: HTMLTextAreaElement;
}) {
  const { card, textarea } = args;
  const viewportHeight =
    typeof window === 'undefined'
      ? Number.POSITIVE_INFINITY
      : window.innerHeight || document.documentElement.clientHeight;

  textarea.style.height = 'auto';
  textarea.style.overflowY = 'hidden';

  const cardRect = card.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  const contentHeight = Math.ceil(textarea.scrollHeight);
  const chromeHeight = Math.max(0, cardRect.height - textareaRect.height);
  const availableCardHeight = viewportHeight - cardRect.top - POPUP_VIEWPORT_MARGIN;
  const availableTextareaHeight = availableCardHeight - chromeHeight;
  const constrainedHeight = availableTextareaHeight > 0
    ? Math.min(contentHeight, Math.floor(availableTextareaHeight))
    : contentHeight;

  textarea.style.height = `${Math.max(0, constrainedHeight)}px`;
  textarea.style.overflowY = constrainedHeight < contentHeight ? 'auto' : 'hidden';
}

export function mountTextEditorPopup(args: MountTextEditorPopupArgs): TextEditorPopupElements {
  const { container, value, placeholder, onInput, onCancel, onSave } = args;
  const elements = createTextEditorPopupElements(placeholder);
  const { card, textarea, cancelButton, saveButton } = elements;

  textarea.value = value;
  textarea.addEventListener('input', () => {
    resizeTextEditorPopupTextareaToContent({ card, textarea });
    onInput(textarea.value);
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.isComposing) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSave();
      return;
    }
  });

  cancelButton.addEventListener('click', onCancel);
  saveButton.addEventListener('click', onSave);
  container.replaceChildren(card);
  resizeTextEditorPopupTextareaToContent({ card, textarea });

  return elements;
}
