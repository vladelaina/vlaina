import { getMermaidElementCode } from '../mermaid/mermaidDom';
import { getMathElementLatex } from '../math/mathSchema';
import { getVideoElementAttrs } from '../video/videoDom';
import { collectAppliedPreviewElements } from './appliedPreviewCollect';
import { makePreviewCloneNonInteractive } from './appliedPreviewClone';

export const IMAGE_BLOCK_CONTAINER_CLASS = 'image-block-container';

const IMAGE_BLOCK_PARAGRAPH_CLASSES = [
  'editor-paragraph-has-image-block',
  'editor-paragraph-has-multiple-image-blocks',
] as const;

const IMAGE_BLOCK_PARAGRAPH_STYLE_PROPS = [
  'display',
  'fontSize',
  'lineHeight',
  'marginBottom',
  'marginTop',
  'minHeight',
  'paddingBottom',
  'paddingTop',
] as const;

export function preserveSourceImageBlockNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceImageCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.classList.contains(IMAGE_BLOCK_CONTAINER_CLASS)
  );
  if (!sourceImageCollection.complete) {
    return;
  }

  const { elements: sourceImages } = sourceImageCollection;
  if (sourceImages.length === 0) {
    return;
  }

  const previewImages = getPreviewImagesForSourceImageBlocks(previewDom, sourceImages);
  if (!previewImages) {
    return;
  }

  previewImages.forEach((previewImage, index) => {
    const sourceImage = sourceImages[index];
    if (!sourceImage) {
      return;
    }

    const clone = sourceImage.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    mirrorImageBlockParagraphLayout(sourceImage, previewImage);
    previewImage.replaceWith(clone);
  });
}

function getPreviewImagesForSourceImageBlocks(
  previewDom: HTMLElement,
  sourceImages: HTMLElement[]
): HTMLElement[] | null {
  const previewImageCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.tagName === 'IMG'
  );
  if (!previewImageCollection.complete) {
    return null;
  }

  const { elements: previewImages } = previewImageCollection;
  if (previewImages.length === sourceImages.length) {
    return previewImages;
  }

  const matchedPreviewImages: HTMLElement[] = [];
  let searchStartIndex = 0;

  for (const sourceImage of sourceImages) {
    const sourceSignature = getImageBlockSignature(sourceImage);
    if (!sourceSignature) {
      return null;
    }

    let matchedImage: HTMLElement | null = null;
    for (let index = searchStartIndex; index < previewImages.length; index += 1) {
      const previewImage = previewImages[index];
      if (!previewImage || getSerializedPreviewImageSignature(previewImage) !== sourceSignature) {
        continue;
      }

      matchedImage = previewImage;
      searchStartIndex = index + 1;
      break;
    }

    if (!matchedImage) {
      return null;
    }
    matchedPreviewImages.push(matchedImage);
  }

  return matchedPreviewImages.length === sourceImages.length ? matchedPreviewImages : null;
}

function getImageBlockSignature(element: HTMLElement): string | null {
  const source = element.dataset.src || element.getAttribute('src');
  if (!source) {
    return null;
  }

  return JSON.stringify([
    source,
    element.dataset.alt || '',
    element.dataset.title || element.getAttribute('title') || '',
    element.dataset.width || element.getAttribute('width') || '',
    element.dataset.align || element.getAttribute('align') || 'center',
  ]);
}

function getSerializedPreviewImageSignature(element: HTMLElement): string | null {
  const source = element.dataset.src || element.getAttribute('src');
  if (!source) {
    return null;
  }

  return JSON.stringify([
    source,
    element.getAttribute('alt') || '',
    element.getAttribute('title') || '',
    element.getAttribute('width') || '',
    element.getAttribute('align') || 'center',
  ]);
}

function closestImageBlockParagraph(element: HTMLElement): HTMLElement | null {
  const paragraph = element.closest('p');
  return paragraph instanceof HTMLElement ? paragraph : null;
}

function mirrorImageBlockParagraphLayout(sourceImage: HTMLElement, previewImage: HTMLElement): void {
  const sourceParagraph = closestImageBlockParagraph(sourceImage);
  const previewParagraph = closestImageBlockParagraph(previewImage);
  if (!sourceParagraph || !previewParagraph) {
    return;
  }

  IMAGE_BLOCK_PARAGRAPH_CLASSES.forEach((className) => {
    if (sourceParagraph.classList.contains(className)) {
      previewParagraph.classList.add(className);
    }
  });

  let computed: CSSStyleDeclaration | null = null;
  IMAGE_BLOCK_PARAGRAPH_STYLE_PROPS.forEach((prop) => {
    const inlineValue = sourceParagraph.style[prop];
    if (inlineValue) {
      previewParagraph.style[prop] = inlineValue;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    computed ??= window.getComputedStyle(sourceParagraph);
    const computedValue = computed[prop];
    if (computedValue) {
      previewParagraph.style[prop] = computedValue;
    }
  });
}

export function preserveSourceFrontmatterNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceFrontmatterCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.classList.contains('frontmatter-block-container')
  );
  if (!sourceFrontmatterCollection.complete) {
    return;
  }

  const { elements: sourceFrontmatters } = sourceFrontmatterCollection;
  if (sourceFrontmatters.length === 0) {
    return;
  }

  const previewFrontmatterCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.dataset.type === 'frontmatter'
  );
  if (
    !previewFrontmatterCollection.complete ||
    previewFrontmatterCollection.elements.length !== sourceFrontmatters.length
  ) {
    return;
  }
  const { elements: previewFrontmatters } = previewFrontmatterCollection;

  previewFrontmatters.forEach((previewFrontmatter, index) => {
    const sourceFrontmatter = sourceFrontmatters[index];
    if (!sourceFrontmatter) {
      return;
    }

    const clone = sourceFrontmatter.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    previewFrontmatter.replaceWith(clone);
  });
}

function getRenderedAtomSignature(element: HTMLElement): string | null {
  const type = element.dataset.type;
  if (type === 'math-inline' || type === 'math-block') {
    return `${type}:${getMathElementLatex(element)}`;
  }

  if (type === 'mermaid') {
    return `${type}:${getMermaidElementCode(element)}`;
  }

  if (type === 'video') {
    const attrs = getVideoElementAttrs(element);
    return JSON.stringify([
      type,
      attrs.src,
      attrs.title ?? '',
      attrs.width ?? '',
      attrs.height ?? '',
    ]);
  }

  return null;
}

function isRenderedAtomElement(element: HTMLElement): boolean {
  const type = element.dataset.type;
  return type === 'math-inline' || type === 'math-block' || type === 'mermaid' || type === 'video';
}

function getRenderedAtomElements(root: HTMLElement): HTMLElement[] | null {
  const collection = collectAppliedPreviewElements(root, isRenderedAtomElement);
  return collection.complete ? collection.elements : null;
}

export function preserveSourceRenderedAtomNodes(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const previewAtoms = getRenderedAtomElements(previewDom);
  if (!previewAtoms || previewAtoms.length === 0) {
    return;
  }

  const sourceAtoms = getRenderedAtomElements(sourceDom);
  if (!sourceAtoms || sourceAtoms.length !== previewAtoms.length) {
    return;
  }

  previewAtoms.forEach((previewAtom, index) => {
    const sourceAtom = sourceAtoms[index];
    if (!sourceAtom) {
      return;
    }

    if (getRenderedAtomSignature(sourceAtom) !== getRenderedAtomSignature(previewAtom)) {
      return;
    }

    const clone = sourceAtom.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    previewAtom.replaceWith(clone);
  });
}
