import { describe, expect, it } from 'vitest';
import { getSidebarLabelClass, getSidebarToneStyles } from './sidebarLabelStyles';

describe('sidebarLabelStyles', () => {
  it('uses one selected row surface for notes and chat sidebars', () => {
    expect(getSidebarToneStyles('notes').activeRow).toContain('var(--notes-sidebar-row-active)');
    expect(getSidebarToneStyles('chat').activeRow).toContain('var(--chat-sidebar-row-active)');
  });

  it('uses one selected label text token across sidebar tones', () => {
    expect(getSidebarLabelClass('notes', { selected: true })).toContain(
      'text-[var(--sidebar-row-selected-text)]'
    );
    expect(getSidebarLabelClass('chat', { selected: true })).toContain(
      'text-[var(--sidebar-row-selected-text)]'
    );
  });
});
