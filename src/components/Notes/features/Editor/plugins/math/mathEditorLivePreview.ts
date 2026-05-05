import { renderLatex } from './katex';

export function renderMathEditorLivePreview(args: {
  anchor: HTMLElement | null;
  latex: string;
  displayMode: boolean;
}) {
  const { anchor, latex, displayMode } = args;
  if (!anchor) {
    return false;
  }

  const { html } = renderLatex(latex, displayMode);
  anchor.dataset.latex = latex;
  anchor.innerHTML = html;
  return true;
}
