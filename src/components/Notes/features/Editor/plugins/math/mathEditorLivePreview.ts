export async function renderMathEditorLivePreview(args: {
  anchor: HTMLElement | null;
  latex: string;
  displayMode: boolean;
}) {
  const { anchor, latex, displayMode } = args;
  if (!anchor) {
    return false;
  }

  const { renderLatex } = await import('./katex');
  anchor.dataset.latex = latex;
  const { html } = renderLatex(latex, displayMode);
  anchor.innerHTML = html;
  return true;
}
