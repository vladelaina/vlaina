import { useEffect } from 'react';
import { isEditableShortcutTarget } from '@/lib/shortcuts/editableGuards';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';

export function useSidebarRenameShortcut(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const isMac =
      typeof window !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      const isF2 = event.key === 'F2';
      const isMacEnter = isMac && event.key === 'Enter';

      if (!isF2 && !isMacEnter) {
        return;
      }

      if (isEditableShortcutTarget(event.target) && !isF2) {
        return;
      }

      if (!triggerHoveredSidebarRename()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [active]);
}
