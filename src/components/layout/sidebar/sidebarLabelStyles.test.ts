import { describe, expect, it } from 'vitest';
import { getSidebarLabelClass, getSidebarSelectedRowSurfaceClass, getSidebarToneStyles } from './sidebarLabelStyles';

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

  it('keeps selected rows flat on hover', () => {
    expect(getSidebarSelectedRowSurfaceClass('notes')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
    expect(getSidebarSelectedRowSurfaceClass('chat')).toContain('hover:shadow-[var(--vlaina-shadow-none)]');
  });
});
