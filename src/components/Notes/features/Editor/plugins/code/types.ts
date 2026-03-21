export interface CodeBlockAttrs {
  language: string | null;
  lineNumbers: boolean;
  wrap: boolean;
  collapsed: boolean;
}

export interface LanguageInfo {
  id: string;
  name: string;
  aliases?: string[];
}
