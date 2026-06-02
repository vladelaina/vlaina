import { renderLatex } from './katex';
import { setMathElementLatex } from './mathSchema';

export function renderMathEditorLivePreview(args: {
  anchor: HTMLElement | null;
  latex: string;
  displayMode: boolean;
}) {
  const { anchor, latex, displayMode } = args;
  if (!anchor) {
    return false;
  }

  setMathElementLatex(anchor, latex);
  const { html } = renderLatex(latex, displayMode);
  anchor.innerHTML = html;
  return true;
}
