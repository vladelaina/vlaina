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

  anchor.dataset.latex = latex;
  const { html } = renderLatex(latex, displayMode);
  anchor.innerHTML = html;
  return true;
}
