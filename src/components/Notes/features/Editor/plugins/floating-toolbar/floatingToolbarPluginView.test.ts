import { describe, expect, it } from 'vitest';
import { shouldLockPreviewToolbarPosition } from './floatingToolbarPluginView';
import type { FloatingToolbarState } from './types';

describe('floatingToolbarPluginView', () => {
  it('locks toolbar position while preview submenus are open', () => {
    const lockedSubMenus: Array<FloatingToolbarState['subMenu']> = [
      'block',
      'alignment',
      'color',
    ];

    lockedSubMenus.forEach((subMenu) => {
      expect(shouldLockPreviewToolbarPosition({ subMenu, hasActivePreview: false })).toBe(true);
    });
  });

  it('locks toolbar position while a direct-button preview is active', () => {
    expect(shouldLockPreviewToolbarPosition({
      subMenu: null,
      hasActivePreview: true,
    })).toBe(true);
  });

  it('does not lock toolbar position for non-preview submenus without an active preview', () => {
    const unlockedSubMenus: Array<FloatingToolbarState['subMenu']> = [
      null,
      'ai',
      'aiReview',
      'link',
    ];

    unlockedSubMenus.forEach((subMenu) => {
      expect(shouldLockPreviewToolbarPosition({ subMenu, hasActivePreview: false })).toBe(false);
    });
  });
});
