import { getCurrentEditorView } from '@/components/Notes/features/Editor/utils/editorViewRegistry';

export type EditorDispatchProfileSample = {
  docChanged: boolean;
  durationMs: number;
  insertedTextLength: number;
  selectionSet: boolean;
  stepCount: number;
};

export type ActiveEditorDispatchProfile = {
  decorationOriginals: Array<{
    originalDecorations: unknown;
    props: { decorations?: unknown };
  }>;
  decorationSamples: Map<string, number[]>;
  originalDispatch: unknown;
  originalUpdateState: unknown;
  originalUpdateStateInner: unknown;
  pluginOriginals: Array<{
    originalApply: unknown;
    stateSpec: { apply?: unknown };
  }>;
  pluginSamples: Map<string, number[]>;
  samples: EditorDispatchProfileSample[];
  startedAt: number;
  updateStateInnerSamples: number[];
  updateStateSamples: number[];
  view: NonNullable<ReturnType<typeof getCurrentEditorView>>;
};
