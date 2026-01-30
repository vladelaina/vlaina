// Code plugin types

export interface CodeBlockAttrs {
  language: string | null;
  lineNumbers: boolean;
  wrap: boolean;
}

export interface HighlightToken {
  content: string;
  color: string;
  offset: number;
}

export interface LanguageInfo {
  id: string;
  name: string;
  aliases?: string[];
}