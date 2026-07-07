import { createRoot, type Root } from 'react-dom/client';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

export function createSlashMenuElement(positionRoot: HTMLElement | null): {
  menuElement: HTMLElement;
  root: Root;
} {
  const menu = document.createElement('div');
  menu.className = `slash-menu !rounded-[var(--vlaina-radius-26px)] ${chatComposerPillSurfaceClass}`;
  menu.setAttribute('data-no-editor-drag-box', 'true');
  menu.style.position = positionRoot ? 'absolute' : 'fixed';
  (positionRoot ?? document.body).appendChild(menu);
  return {
    menuElement: menu,
    root: createRoot(menu),
  };
}

export function destroySlashMenuElement(menuElement: HTMLElement | null, root: Root | null): void {
  if (root) {
    window.setTimeout(() => root.unmount(), 0);
  }

  menuElement?.remove();
}
