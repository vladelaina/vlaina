// TOC plugin types

export interface TocAttrs {
  maxLevel: number; // Maximum heading level to include (1-6)
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
}