export interface TocAttrs {
  maxLevel: number;
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
  pos: number;
}
