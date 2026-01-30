// Table plugin types

export interface TableCellAttrs {
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
}

export interface TableSelection {
  anchorRow: number;
  anchorCol: number;
  headRow: number;
  headCol: number;
}

export interface TableMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  cellPos: number;
}