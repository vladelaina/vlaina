import { getCurrentEditorView } from '@/components/Notes/features/Editor/utils/editorViewRegistry';
import type { EditorDispatchProfileSummary } from './syncE2EBridgeTypes';
import type { ActiveEditorDispatchProfile } from './syncE2EEditorProfileTypes';
import {
  installDecorationPropProfilers,
  installPluginApplyProfilers,
} from './syncE2EEditorProfileInstallers';
import {
  buildEditorDispatchProfileSummary,
  getTransactionInsertedTextLength,
} from './syncE2EEditorProfileSummary';

let activeEditorDispatchProfile: ActiveEditorDispatchProfile | null = null;

export function stopEditorDispatchProfile(): EditorDispatchProfileSummary | null {
  const profile = activeEditorDispatchProfile;
  if (!profile) return null;

  activeEditorDispatchProfile = null;
  (profile.view as any).dispatch = profile.originalDispatch;
  if (profile.originalUpdateState) {
    (profile.view as any).updateState = profile.originalUpdateState;
  }
  if (profile.originalUpdateStateInner) {
    (profile.view as any).updateStateInner = profile.originalUpdateStateInner;
  }
  for (const pluginOriginal of profile.pluginOriginals) {
    pluginOriginal.stateSpec.apply = pluginOriginal.originalApply;
  }
  for (const decorationOriginal of profile.decorationOriginals) {
    decorationOriginal.props.decorations = decorationOriginal.originalDecorations;
  }

  return buildEditorDispatchProfileSummary(profile);
}

export function startEditorDispatchProfile(): boolean {
  const view = getCurrentEditorView();
  if (!view) return false;

  stopEditorDispatchProfile();

  const originalDispatch = view.dispatch;
  const originalUpdateState = (view as any).updateState;
  const originalUpdateStateInner = (view as any).updateStateInner;
  const profile: ActiveEditorDispatchProfile = {
    decorationOriginals: [],
    decorationSamples: new Map(),
    originalDispatch,
    originalUpdateState,
    originalUpdateStateInner,
    pluginOriginals: [],
    pluginSamples: new Map(),
    samples: [],
    startedAt: performance.now(),
    updateStateInnerSamples: [],
    updateStateSamples: [],
    view,
  };

  installPluginApplyProfilers(profile);
  installDecorationPropProfilers(profile);

  if (typeof originalUpdateState === 'function') {
    (view as any).updateState = function profiledUpdateState(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return originalUpdateState.apply(this, args);
      } finally {
        profile.updateStateSamples.push(performance.now() - startedAt);
      }
    };
  }

  if (typeof originalUpdateStateInner === 'function') {
    (view as any).updateStateInner = function profiledUpdateStateInner(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return originalUpdateStateInner.apply(this, args);
      } finally {
        profile.updateStateInnerSamples.push(performance.now() - startedAt);
      }
    };
  }

  (view as any).dispatch = function profiledDispatch(this: unknown, tr: unknown) {
    const startedAt = performance.now();
    try {
      return (originalDispatch as (this: unknown, tr: unknown) => unknown).call(this, tr);
    } finally {
      profile.samples.push({
        docChanged: Boolean((tr as { docChanged?: boolean }).docChanged),
        durationMs: performance.now() - startedAt,
        insertedTextLength: getTransactionInsertedTextLength(tr),
        selectionSet: Boolean((tr as { selectionSet?: boolean }).selectionSet),
        stepCount: (tr as { steps?: readonly unknown[] }).steps?.length ?? 0,
      });
    }
  };
  activeEditorDispatchProfile = profile;

  return true;
}
