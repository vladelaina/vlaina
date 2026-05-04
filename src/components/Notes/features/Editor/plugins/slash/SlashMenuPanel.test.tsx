import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenuPanel } from './SlashMenuPanel';
import { slashMenuItems } from './slashItems';

describe('SlashMenuPanel', () => {
  it('renders options without groups or descriptions and selected state', () => {
    const items = slashMenuItems.slice(0, 3);

    render(
      <SlashMenuPanel
        items={items}
        selectedIndex={0}
        onHoverItem={vi.fn()}
        onSelectItem={vi.fn()}
      />
    );

    expect(screen.getByRole('listbox', { name: 'Insert block' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Heading 1/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Basic')).not.toBeInTheDocument();
    expect(screen.queryByText('Plain text paragraph')).not.toBeInTheDocument();
  });

  it('notifies hover and select interactions', () => {
    const onHoverItem = vi.fn();
    const onSelectItem = vi.fn();
    const items = slashMenuItems.slice(0, 3);

    render(
      <SlashMenuPanel
        items={items}
        selectedIndex={0}
        onHoverItem={onHoverItem}
        onSelectItem={onSelectItem}
      />
    );

    const option = screen.getByRole('option', { name: /Heading 1/i });
    fireEvent.mouseEnter(option);
    fireEvent.mouseDown(option);

    expect(onHoverItem).toHaveBeenCalledWith(0);
    expect(onSelectItem).toHaveBeenCalledWith(0);
  });
});
