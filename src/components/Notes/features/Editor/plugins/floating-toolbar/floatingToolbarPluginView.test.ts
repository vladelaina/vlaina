import { describe, expect, it, vi } from 'vitest';
import { shouldLockPreviewToolbarPosition } from './floatingToolbarPluginView';
import {
  collectToolbarSubmenus,
  correctToolbarSubmenusToContentBounds,
} from './floatingToolbarSubmenus';
import { correctToolbarYToViewportBounds } from './floatingToolbarDom';
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

  it('collects toolbar submenus without querySelectorAll materialization', () => {
    const toolbar = document.createElement('div');
    toolbar.innerHTML = [
      '<div><div class="toolbar-submenu" data-id="first"></div></div>',
      '<div class="toolbar-submenu" data-id="second"></div>',
    ].join('');
    const querySelectorAllSpy = vi.spyOn(toolbar, 'querySelectorAll').mockImplementation(() => {
      throw new Error('querySelectorAll should not be used for toolbar submenu scans');
    });

    try {
      const submenus = collectToolbarSubmenus(toolbar);

      expect(submenus.map((submenu) => submenu.dataset.id)).toEqual(['first', 'second']);
    } finally {
      querySelectorAllSpy.mockRestore();
    }
  });

  it('corrects visible submenu overflow against content bounds', () => {
    const toolbar = document.createElement('div');
    const submenu = document.createElement('div');
    submenu.className = 'toolbar-submenu';
    toolbar.append(submenu);
    Object.defineProperty(submenu, 'offsetParent', { configurable: true, value: toolbar });
    submenu.getBoundingClientRect = vi.fn(() => ({
      bottom: 0,
      height: 0,
      left: 80,
      right: 180,
      top: 0,
      width: 100,
      x: 80,
      y: 0,
      toJSON: () => {},
    }));

    correctToolbarSubmenusToContentBounds(toolbar, { left: 40, right: 160 });

    expect(submenu.style.getPropertyValue('--vlaina-toolbar-submenu-shift-x')).toBe('-20px');
  });

  it('keeps the toolbar vertically inside the visible viewport bounds', () => {
    const toolbar = document.createElement('div');
    const inner = document.createElement('div');
    inner.className = 'floating-toolbar-inner';
    toolbar.append(inner);
    inner.getBoundingClientRect = vi.fn(() => ({
      bottom: 30,
      height: 40,
      left: 0,
      right: 100,
      top: -10,
      width: 100,
      x: 0,
      y: -10,
      toJSON: () => {},
    }));

    const correctedY = correctToolbarYToViewportBounds(toolbar, 20, { top: 0, bottom: 200 });

    expect(correctedY).toBeGreaterThan(20);
    expect(toolbar.style.top).toBe(`${correctedY}px`);
  });
});
