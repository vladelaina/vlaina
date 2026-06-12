import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesOutline } from './NotesOutline';

const hoisted = vi.hoisted(() => ({
  outlineState: {
    headings: [
      { id: 'parent', level: 1, text: 'Parent', from: 0, to: 6 },
      { id: 'child', level: 2, text: 'Child', from: 7, to: 12 },
    ],
    activeId: null as string | null,
  },
  jumpToHeading: vi.fn(),
  renameHeading: vi.fn(() => true),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useHeldPageScroll', () => ({
  useHeldPageScroll: vi.fn(),
}));

vi.mock('../NotesSidebarTopActions', () => ({
  NotesSidebarTopActions: () => null,
}));

vi.mock('./useNotesOutline', () => ({
  useNotesOutline: () => ({
    headings: hoisted.outlineState.headings,
    activeId: hoisted.outlineState.activeId,
    jumpToHeading: hoisted.jumpToHeading,
    renameHeading: hoisted.renameHeading,
  }),
}));

describe('NotesOutline', () => {
  beforeEach(() => {
    hoisted.outlineState.activeId = null;
    hoisted.jumpToHeading.mockClear();
    hoisted.renameHeading.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('colors collapsed-section chevrons blue on hover in inactive outline rows', () => {
    render(<NotesOutline enabled />);

    const toggle = screen.getByRole('button', { name: 'Collapse section' });
    const affordance = toggle.querySelector('[aria-hidden="true"]');

    expect(affordance?.className).toContain('text-[color:var(--vlaina-collapse-triangle-sidebar-soft-fg)]');
    expect(affordance?.className).toContain('group-hover/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).toContain('group-focus-within/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).toContain('hover:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).not.toContain('hover:text-[var(--vlaina-sidebar-notes-text)]');
  });
});
