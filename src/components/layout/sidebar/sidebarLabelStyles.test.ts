import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getSidebarIdleRowSurfaceClass,
  getSidebarLabelClass,
  getSidebarSelectedRowSurfaceClass,
  getSidebarToneStyles,
} from './sidebarLabelStyles';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('sidebarLabelStyles', () => {
  it('uses one selected row surface for notes and chat sidebars', () => {
    expect(getSidebarToneStyles('notes').activeRow).toContain('var(--vlaina-sidebar-notes-row-active)');
    expect(getSidebarToneStyles('chat').activeRow).toContain('var(--vlaina-sidebar-chat-row-active)');
  });

  it('uses one selected label text token across sidebar tones', () => {
    expect(getSidebarLabelClass('notes', { selected: true })).toContain(
      'text-[var(--vlaina-sidebar-row-selected-text)]'
    );
    expect(getSidebarLabelClass('chat', { selected: true })).toContain(
      'text-[var(--vlaina-sidebar-row-selected-text)]'
    );
  });

  it('tints idle sidebar labels blue on row hover without requiring a hover surface', () => {
    expect(getSidebarLabelClass('notes')).toContain(
      'group-hover/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)]'
    );
    expect(getSidebarLabelClass('chat')).toContain(
      'group-hover/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)]'
    );
  });

  it('keeps selected rows flat on hover', () => {
    expect(getSidebarSelectedRowSurfaceClass('notes')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
    expect(getSidebarSelectedRowSurfaceClass('chat')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
  });

  it('keeps idle sidebar row hover surfaces transparent', () => {
    expect(getSidebarIdleRowSurfaceClass('notes')).toContain('hover:bg-transparent');
    expect(getSidebarIdleRowSurfaceClass('notes')).toContain('hover:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(getSidebarIdleRowSurfaceClass('notes')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
    expect(getSidebarIdleRowSurfaceClass('chat')).toContain('hover:bg-transparent');
    expect(getSidebarIdleRowSurfaceClass('chat')).toContain('hover:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(getSidebarIdleRowSurfaceClass('chat')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
  });

  it('keeps context-menu highlighted rows on the same transparent hover treatment', () => {
    expect(getSidebarToneStyles('notes').highlightRow).toContain('bg-transparent');
    expect(getSidebarToneStyles('notes').highlightRow).toContain('text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(getSidebarToneStyles('notes').highlightRow).toContain('shadow-[var(--vlaina-shadow-none)]');
    expect(getSidebarToneStyles('chat').highlightRow).toContain('bg-transparent');
    expect(getSidebarToneStyles('chat').highlightRow).toContain('text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(getSidebarToneStyles('chat').highlightRow).toContain('shadow-[var(--vlaina-shadow-none)]');
  });

  it('keeps settings sidebar tab hover surfaces transparent with blue text and icons', () => {
    const source = readSource('src/components/Settings/SettingsSidebar.tsx');

    expect(source).toContain('group/settings-sidebar-tab');
    expect(source).toContain('hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(source).toContain('group-hover/settings-sidebar-tab:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(source).not.toContain('hover:bg-[var(--vlaina-sidebar-notes-row-hover)] font-medium');
  });

  it('keeps sidebar context menu hover surfaces transparent', () => {
    const itemSource = readSource('src/components/layout/sidebar/context-menu/SidebarContextMenuParts.tsx');
    const submenuSource = readSource('src/components/layout/sidebar/context-menu/SidebarContextMenuSubmenu.tsx');

    expect(itemSource).toContain('hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(itemSource).toContain('hover:bg-transparent hover:text-[var(--vlaina-color-status-danger-fg)]');
    expect(itemSource).toContain('group-hover/sidebar-context-menu-item:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(submenuSource).toContain('hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(submenuSource).toContain('group-hover/sidebar-context-menu-item:text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(itemSource).not.toContain('hover:bg-[var(--vlaina-sidebar-notes-row-hover)]');
    expect(submenuSource).not.toContain('hover:bg-[var(--vlaina-sidebar-notes-row-hover)]');
  });
});
