export interface HandleBlockTarget {
  pos: number;
  rect: DOMRect;
  isListItem: boolean;
}

export interface DropTarget {
  insertPos: number;
  lineY: number;
  lineLeft: number;
  lineWidth: number;
}
