export type BlockTextMatcher = {
  include?: string;
  exact?: string;
  exclude?: string[];
};

export type MarkdownDragSyntaxCase = {
  label: string;
  targetSelector: string;
  targetText?: string;
  match?: BlockTextMatcher;
  gap: 'standard' | 'list' | 'nested-list';
  anchorSelector?: string;
  anchorText?: string;
};

export type SyntaxHandleGeometry = {
  label: string;
  selectedCount: number;
  selectedMatchesTarget: boolean;
  targetTagName: string;
  targetClassName: string;
  targetText: string;
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  handleRightGapX: number;
  anchorGapX: number | null;
  targetIndentFromAnchorX: number | null;
};

export type DragVisualGeometry = {
  dragActive: boolean;
  controlsDragging: boolean;
  sourceCount: number;
  selectedCount: number;
  sourceBackgroundColor: string | null;
  sourceBoxShadow: string | null;
  sourceOpacity: string | null;
  sourceAfterBackgroundColor: string | null;
  sourceAfterLeft: number | null;
  sourceAfterRight: number | null;
  sourceBleedStart: number | null;
  sourceBleedEnd: number | null;
  expectedBackground: string;
  previewExists: boolean;
  previewWidth: number | null;
  previewHeight: number | null;
  previewBackgroundColor: string | null;
  previewOpacity: string | null;
  previewBoxShadow: string | null;
  previewLayerBackgroundColor: string | null;
  previewLayerOpacity: string | null;
  previewLayerBoxShadow: string | null;
  controlsBeforeBackgroundColor: string | null;
};
