import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotesSidebarRow } from './NotesSidebarRow';

describe('NotesSidebarRow', () => {
  it('keeps inactive action fades transparent until the row is hovered', () => {
    render(
      <NotesSidebarRow
        main={<span>alpha.md</span>}
        actions={<button type="button">More</button>}
      />,
    );

    const fade = screen.getByRole('button', { name: 'More' }).parentElement?.firstElementChild;

    expect(fade).toHaveClass('from-transparent');
    expect(fade).toHaveClass('group-hover/sidebar-row:from-[var(--vlaina-sidebar-notes-row-hover)]');
    expect(fade?.className).not.toContain('from-[var(--vlaina-sidebar-notes-fade)]');
  });
});
