export interface MathEditorElements {
  card: HTMLElement;
  content: HTMLElement;
  textarea: HTMLTextAreaElement;
  actions: HTMLElement;
  cancelButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
}

export interface MountMathEditorCardArgs {
  container: HTMLElement;
  latex: string;
  displayMode: boolean;
  onInput: (latex: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function createMathEditorElements(): MathEditorElements {
  const card = document.createElement('div');
  card.className = 'math-editor-card';

  const content = document.createElement('div');
  content.className = 'math-editor-content';

  const textarea = document.createElement('textarea');
  textarea.className = 'math-editor-textarea';
  textarea.placeholder = 'Enter LaTeX...';

  const actions = document.createElement('div');
  actions.className = 'math-editor-footer';

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'math-editor-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'math-editor-action-button math-editor-action-button-secondary';
  cancelButton.setAttribute('aria-label', 'Cancel');
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'math-editor-action-button math-editor-action-button-primary';
  saveButton.setAttribute('aria-label', 'Save');
  saveButton.textContent = 'Save';

  content.append(textarea);
  buttonGroup.append(cancelButton, saveButton);
  actions.append(buttonGroup);
  card.append(content, actions);

  return { card, content, textarea, actions, cancelButton, saveButton };
}

export function mountMathEditorCard(args: MountMathEditorCardArgs): MathEditorElements {
  const { container, latex, displayMode: _displayMode, onInput, onCancel, onSave } = args;
  const elements = createMathEditorElements();
  const { card, textarea, cancelButton, saveButton } = elements;

  textarea.value = latex;
  textarea.addEventListener('input', () => onInput(textarea.value));
  textarea.addEventListener('keydown', (event) => {
    if (event.isComposing) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
      return;
    }
  });

  cancelButton.addEventListener('click', onCancel);
  saveButton.addEventListener('click', onSave);
  container.replaceChildren(card);

  return elements;
}
