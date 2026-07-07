export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
  position?: {
    start?: { column?: number; line?: number; offset?: number };
    end?: { column?: number; line?: number; offset?: number };
  };
}

export interface RemarkNotesInlineExtensionsOptions {
  stripAbbrDefinitions?: boolean;
}
