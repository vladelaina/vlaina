import { lazy } from 'react';
import type { EditorTopRightToolbarProps } from './EditorTopRightToolbar';

export const EditorTopRightToolbar = lazy(async () => {
  const mod = await import('./EditorTopRightToolbar');
  return {
    default: (props: EditorTopRightToolbarProps) => (
      <mod.EditorTopRightToolbar {...props} />
    ),
  };
});

export const MilkdownEditorRuntime = lazy(async () => {
  const mod = await import('./MilkdownEditorInner');
  return { default: mod.MilkdownEditorRuntime };
});
