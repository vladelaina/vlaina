import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenuPanel } from './SlashMenuPanel';
import { slashMenuItems } from './slashItems';

describe('SlashMenuPanel', () => {
  it('renders grouped options and selected state', () => {
    render(
      <SlashMenuPanel
        items={slashMenuItems.slice(0, 3)}
        selectedIndex={1}
        onHoverItem={vi.fn()}
        onSelectItem={vi.fn()}
      />
    );

    expect(screen.getByRole('listbox', { name: 'Insert block' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Heading 1/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('notifies hover and select interactions', () => {
    const onHoverItem = vi.fn();
    const onSelectItem = vi.fn();

    render(
      <SlashMenuPanel
        items={slashMenuItems.slice(0, 2)}
        selectedIndex={0}
        onHoverItem={onHoverItem}
        onSelectItem={onSelectItem}
      />
    );

    const option = screen.getByRole('option', { name: /Heading 1/i });
    fireEvent.mouseEnter(option);
    fireEvent.mouseDown(option);

    expect(onHoverItem).toHaveBeenCalledWith(1);
    expect(onSelectItem).toHaveBeenCalledWith(1);
  });
});
