import {
  MAX_APPLIED_PREVIEW_DOM_SCAN_ELEMENTS,
  MAX_APPLIED_PREVIEW_MATCHED_ELEMENTS,
} from './appliedPreviewLimits';

type AppliedPreviewElementCollection = {
  elements: HTMLElement[];
  complete: boolean;
};

export function collectAppliedPreviewElements(
  root: HTMLElement,
  matches: (element: HTMLElement) => boolean,
  options: {
    maxScanned?: number;
    maxMatches?: number;
  } = {}
): AppliedPreviewElementCollection {
  const maxScanned = options.maxScanned ?? MAX_APPLIED_PREVIEW_DOM_SCAN_ELEMENTS;
  const maxMatches = options.maxMatches ?? MAX_APPLIED_PREVIEW_MATCHED_ELEMENTS;
  const elements: HTMLElement[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 1);
  let scanned = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > maxScanned) {
      return { elements: [], complete: false };
    }

    if (!(node instanceof HTMLElement) || !matches(node)) {
      continue;
    }

    elements.push(node);
    if (elements.length > maxMatches) {
      return { elements: [], complete: false };
    }
  }

  return { elements, complete: true };
}
