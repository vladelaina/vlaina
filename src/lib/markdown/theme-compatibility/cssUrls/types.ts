export interface CssUrlToken {
  start: number;
  end: number;
  raw: string;
  url: string;
}

export interface RelativeMarkdownThemeCssUrl {
  url: string;
  path: string;
  suffix: string;
}

export interface MarkdownThemeCssImport {
  url: string;
  path: string;
  suffix: string;
}
