export interface MilkdownToken<T> {
  readonly __milkdownType?: T;
}

export interface MilkdownContext {
  get<T>(token: MilkdownToken<T>): T;
}

export interface MilkdownEditorLike {
  ctx: MilkdownContext;
}

export type EditorGetter = () => MilkdownEditorLike | null | undefined;

export interface PendingMarkdownSnapshot {
  baseContent: string;
  markdown: string;
}

export type CompositionStartSelection = {
  from: number;
  to: number;
  text: string;
};

export interface PendingMarkdownAutosaveOptions {
  currentNotePath: string | undefined;
  currentNoteDiskRevision: number;
  currentNoteContent: string;
  updateContent: (content: string) => void;
  debouncedSave: () => void;
  onLocalMarkdownCommitted?: (content: string) => void;
}
