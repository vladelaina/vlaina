import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarInlineRenameInput } from './SidebarInlineRenameInput';

describe('SidebarInlineRenameInput', () => {
  it('focuses and selects the full value on mount', async () => {
    render(
      <SidebarInlineRenameInput
        value="Example"
        onValueChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        aria-label="Rename"
      />,
    );

    const input = screen.getByLabelText('Rename') as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('Example'.length);
    });
  });

  it('submits on blur and Enter, and cancels on Escape', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <SidebarInlineRenameInput
        value="Example"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        onCancel={onCancel}
        aria-label="Rename"
      />,
    );

    const input = screen.getByLabelText('Rename');

    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stops click and mouse down propagation', () => {
    const onParentClick = vi.fn();
    const onParentMouseDown = vi.fn();

    render(
      <div onClick={onParentClick} onMouseDown={onParentMouseDown}>
        <SidebarInlineRenameInput
          value="Example"
          onValueChange={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
          aria-label="Rename"
        />
      </div>,
    );

    const input = screen.getByLabelText('Rename');

    fireEvent.mouseDown(input);
    fireEvent.click(input);

    expect(onParentMouseDown).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
