export type AutoInsertedCloser = {
  close: string;
  pos: number;
};

export type DocLike = {
  content: { size: number };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
};

export type SelectionLike = {
  empty: boolean;
  from: number;
  to?: number;
  $from: {
    parent: {
      isTextblock: boolean;
      textContent: string;
    };
    parentOffset: number;
  };
};

export type EditorStateLike = {
  doc: DocLike;
  selection: SelectionLike;
};

export type MappingLike = {
  map: (pos: number, assoc?: number) => number;
  mapResult?: (pos: number, assoc?: number) => { pos: number; deleted: boolean };
};

export type TransactionLike = {
  docChanged: boolean;
  getMeta?: (key: string | unknown) => unknown;
  mapping: MappingLike;
};
