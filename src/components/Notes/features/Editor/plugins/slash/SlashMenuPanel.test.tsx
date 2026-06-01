import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenuPanel } from './SlashMenuPanel';
import { slashMenuItems } from './slashItems';

describe('SlashMenuPanel', () => {
  it('uses the shared composer pill surface for slash popups', () => {
    const menuViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/slash/SlashMenuView.ts'),
      'utf8',
    );
    const videoPromptSource = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/slash/slashVideoPrompt.ts'),
      'utf8',
    );

    expect(menuViewSource).toContain('chatComposerPillSurfaceClass');
    expect(menuViewSource).toContain('!rounded-[var(--vlaina-radius-26px)]');
    expect(videoPromptSource).toContain('chatComposerPillSurfaceClass');
    expect(videoPromptSource).toContain('!rounded-[var(--vlaina-radius-26px)]');
  });

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

  it('notifies hover only on pointer movement and select interactions', () => {
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
    expect(onHoverItem).not.toHaveBeenCalled();

    fireEvent.mouseMove(option);
    fireEvent.mouseDown(option);

    expect(onHoverItem).toHaveBeenCalledWith(0);
    expect(onSelectItem).toHaveBeenCalledWith(0);
  });
});
