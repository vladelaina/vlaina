import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorOutlineRail } from './EditorOutlineRail';

const mocks = vi.hoisted(() => ({
  activeId: 'overview' as string | null,
  headings: [
    { id: 'intro', level: 1, text: 'Introduction', from: 0, to: 12 },
    { id: 'overview', level: 2, text: 'Overview', from: 13, to: 21 },
    { id: 'details', level: 3, text: 'Details', from: 22, to: 29 },
  ],
  jumpToHeading: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../Sidebar/Outline/useNotesOutline', () => ({
  useNotesOutline: () => ({
    activeId: mocks.activeId,
    headings: mocks.headings,
    jumpToHeading: mocks.jumpToHeading,
  }),
}));

describe('EditorOutlineRail', () => {
  beforeEach(() => {
    mocks.activeId = 'overview';
    mocks.headings = [
      { id: 'intro', level: 1, text: 'Introduction', from: 0, to: 12 },
      { id: 'overview', level: 2, text: 'Overview', from: 13, to: 21 },
      { id: 'details', level: 3, text: 'Details', from: 22, to: 29 },
    ];
    mocks.jumpToHeading.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a persistent hierarchy and jumps to a selected heading', () => {
    const { container } = render(<EditorOutlineRail enabled />);
    const rail = container.querySelector<HTMLElement>('[data-editor-outline-rail="true"]');
    const outline = screen.getByRole('navigation', { name: 'notes.documentOutline' });
    const overview = screen.getByRole('button', { name: 'Overview' });

    expect(rail).not.toBeNull();
    expect(outline).toBeVisible();
    expect(screen.getByText('notes.documentOutline')).toBeVisible();
    expect(overview).toHaveAttribute('data-level', '2');
    expect(overview).toHaveAttribute('aria-current', 'location');

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(mocks.jumpToHeading).toHaveBeenCalledWith('details');
  });

  it('keeps every outline row keyboard focusable', () => {
    render(<EditorOutlineRail enabled />);
    const rows = screen.getAllByRole('button');

    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).not.toHaveAttribute('tabindex', '-1'));
  });

  it('does not render without an editable outline', () => {
    const { container, rerender } = render(<EditorOutlineRail enabled={false} />);

    expect(container).toBeEmptyDOMElement();

    mocks.headings = [];
    rerender(<EditorOutlineRail enabled />);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the complete long outline visible with its active section marked', () => {
    mocks.headings = Array.from({ length: 30 }, (_, index) => ({
      id: `heading-${index}`,
      level: (index % 4) + 1,
      text: `Heading ${index}`,
      from: index,
      to: index + 1,
    }));
    mocks.activeId = 'heading-22';

    render(<EditorOutlineRail enabled />);

    expect(screen.getAllByRole('button')).toHaveLength(30);
    expect(screen.getByRole('button', { name: 'Heading 22' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
});
