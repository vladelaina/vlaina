import type { NotesStore } from '../types';

export function setNoteTabDirtyState(
  openTabs: NotesStore['openTabs'],
  path: string,
  isDirty: boolean
): NotesStore['openTabs'] {
  let changed = false;

  const nextOpenTabs = openTabs.map((tab) => {
    if (tab.path !== path || tab.isDirty === isDirty) {
      return tab;
    }

    changed = true;
    return { ...tab, isDirty };
  });

  return changed ? nextOpenTabs : openTabs;
}
