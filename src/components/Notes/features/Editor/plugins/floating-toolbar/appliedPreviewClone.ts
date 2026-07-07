import { collectAppliedPreviewElements } from './appliedPreviewCollect';

function isPreviewInteractiveElement(element: HTMLElement): boolean {
  return (
    (element.tagName === 'IFRAME' && element.hasAttribute('src')) ||
    element.hasAttribute('contenteditable') ||
    element.hasAttribute('tabindex')
  );
}

export function makePreviewCloneNonInteractive(clone: HTMLElement): boolean {
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('tabindex');

  const interactiveCollection = collectAppliedPreviewElements(clone, isPreviewInteractiveElement);
  if (!interactiveCollection.complete) {
    return false;
  }

  interactiveCollection.elements.forEach((element) => {
    if (element.tagName === 'IFRAME' && element.hasAttribute('src')) {
      element.dataset.previewSrc = element.getAttribute('src') ?? '';
      element.removeAttribute('src');
    }
    element.removeAttribute('contenteditable');
    element.removeAttribute('tabindex');
  });

  return true;
}
