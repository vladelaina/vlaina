import {
  createTextEditorPopupElements,
  mountTextEditorPopup,
  type TextEditorPopupElements,
} from '../shared/textEditorPopupDom';

export type MathEditorElements = TextEditorPopupElements;

export interface MountMathEditorCardArgs {
  container: HTMLElement;
  latex: string;
  displayMode: boolean;
  placeholder?: string;
  onInput: (latex: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function createMathEditorElements(placeholder = 'Enter LaTeX...'): MathEditorElements {
  return createTextEditorPopupElements(placeholder);
}

export function mountMathEditorCard(args: MountMathEditorCardArgs): MathEditorElements {
  const { container, latex, displayMode: _displayMode, placeholder, onInput, onCancel, onSave } = args;
  return mountTextEditorPopup({
    container,
    value: latex,
    placeholder: placeholder ?? 'Enter LaTeX...',
    onInput,
    onCancel,
    onSave,
  });
}
