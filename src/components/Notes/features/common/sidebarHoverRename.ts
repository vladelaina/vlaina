interface SidebarHoverRenameEntry {
  startRename: () => void;
  cancelRename: () => void;
  isRenaming: () => boolean;
}

const renameEntries = new Map<string, SidebarHoverRenameEntry>();
let hoveredPath: string | null = null;

export function registerSidebarHoverRenameTarget(
  path: string,
  entry: SidebarHoverRenameEntry,
) {
  renameEntries.set(path, entry);

  return () => {
    if (renameEntries.get(path) === entry) {
      renameEntries.delete(path);
    }
  };
}

export function setHoveredSidebarRenamePath(path: string | null) {
  hoveredPath = path;
}

export function clearHoveredSidebarRenamePath(path: string) {
  if (hoveredPath === path) {
    hoveredPath = null;
  }
}

export function triggerHoveredSidebarRename() {
  if (hoveredPath === null) {
    return false;
  }

  const entry = renameEntries.get(hoveredPath);
  if (!entry) {
    return false;
  }

  if (entry.isRenaming()) {
    entry.cancelRename();
    return true;
  }

  entry.startRename();
  return true;
}
