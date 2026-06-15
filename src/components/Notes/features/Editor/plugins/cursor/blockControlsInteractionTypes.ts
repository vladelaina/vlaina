export interface HandleBlockTarget {
  pos: number;
  rect: DOMRect;
  isListItem: boolean;
  element?: HTMLElement;
}

export interface DropTarget {
  insertPos: number;
  lineY: number;
  lineLeft: number;
  lineWidth: number;
}
