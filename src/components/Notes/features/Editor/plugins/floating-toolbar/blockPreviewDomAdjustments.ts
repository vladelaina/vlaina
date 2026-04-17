export const PREVIEW_HIDE_LIST_MARKER_ATTR = 'data-preview-hide-list-marker';
export const PREVIEW_HIDE_BLOCKQUOTE_ATTR = 'data-preview-hide-blockquote';

export interface BlockPreviewDomAdjustment {
  node: HTMLElement;
  attributes: Record<string, string>;
}

export function getBlockPreviewStructuralStyles(target: HTMLElement): Record<string, string> {
  if (!(target.closest('li') instanceof HTMLElement)) {
    return {};
  }

  return {
    marginLeft: 'calc(-1.5rem)',
  };
}

export function collectBlockPreviewDomAdjustments(target: HTMLElement): BlockPreviewDomAdjustment[] {
  const adjustments: BlockPreviewDomAdjustment[] = [];

  const listItem = target.closest('li');
  if (listItem instanceof HTMLElement) {
    adjustments.push({
      node: listItem,
      attributes: {
        [PREVIEW_HIDE_LIST_MARKER_ATTR]: 'true',
      },
    });
  }

  const blockquote = target.closest('blockquote');
  if (blockquote instanceof HTMLElement && blockquote !== target) {
    adjustments.push({
      node: blockquote,
      attributes: {
        [PREVIEW_HIDE_BLOCKQUOTE_ATTR]: 'true',
      },
    });
  }

  return adjustments;
}
