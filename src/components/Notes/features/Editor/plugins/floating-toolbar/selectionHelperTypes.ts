export type MarkLike = {
  type: { name: string };
  attrs?: Record<string, unknown>;
};

export type TextNodeLike = {
  isText?: boolean;
  text?: string | null;
  nodeSize: number;
  marks: readonly MarkLike[];
};

export type NodeWithTypeAndAttrs = {
  type: { name: string };
  attrs?: Record<string, unknown>;
};

export type ResolvedPosLike = {
  depth: number;
  node: (depth: number) => NodeWithTypeAndAttrs;
  before: (depth: number) => number;
  parent?: NodeWithTypeAndAttrs;
};

export type TextRange = {
  from: number;
  to: number;
};

export type SelectedTextContext = {
  node: TextNodeLike;
  pos: number;
  selectedFrom: number;
  selectedTo: number;
};

export type TraversableNode = {
  child?: (index: number) => TraversableNode;
  childCount?: number;
  nodeSize?: number;
};
