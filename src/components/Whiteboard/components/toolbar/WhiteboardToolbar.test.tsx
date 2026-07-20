import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WHITEBOARD_DEFAULT_BRUSH_COLORS, WHITEBOARD_DEFAULT_BRUSH_SIZES } from '../../model/whiteboardModel';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon-name={name} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function renderToolbar(overrides: Partial<ComponentProps<typeof WhiteboardToolbar>> = {}) {
  const onBrushColorChange = vi.fn();
  const onBrushSizeSelect = vi.fn();
  const onToolChange = vi.fn();
  const rendered = render(
    <WhiteboardToolbar
        active
        brushColors={WHITEBOARD_DEFAULT_BRUSH_COLORS}
        brushSizes={WHITEBOARD_DEFAULT_BRUSH_SIZES}
        spacePressed={false}
        tool="select"
        onBrushColorChange={onBrushColorChange}
        onBrushSizeSelect={onBrushSizeSelect}
        onImageAdd={vi.fn()}
        onToolChange={onToolChange}
        {...overrides}
    />,
  );
  return { onBrushColorChange, onBrushSizeSelect, onToolChange, ...rendered };
}

describe('WhiteboardToolbar', () => {
  it('renders only while the whiteboard is active', () => {
    const props = {
      active: true,
      brushColors: WHITEBOARD_DEFAULT_BRUSH_COLORS,
      brushSizes: WHITEBOARD_DEFAULT_BRUSH_SIZES,
      spacePressed: false,
      tool: 'select' as const,
      onBrushColorChange: vi.fn(),
      onBrushSizeSelect: vi.fn(),
      onImageAdd: vi.fn(),
      onToolChange: vi.fn(),
    };
    const { rerender } = render(<WhiteboardToolbar {...props} active={false} />);
    expect(screen.queryByRole('button', { name: 'whiteboard.tool.select' })).not.toBeInTheDocument();
    rerender(<WhiteboardToolbar {...props} />);
    expect(screen.getAllByRole('button', { name: 'whiteboard.tool.select' }).length).toBeGreaterThan(0);
  });

  it('groups lasso and both erasers in one panel', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'whiteboard.tool.eraser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.tool.strokeEraser' })).toBeInTheDocument();
  });

  it('opens the active lasso details when the whiteboard first appears', () => {
    const { container } = renderToolbar();

    expect(container.querySelector('[data-whiteboard-tool-panel="true"]')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'whiteboard.tool.select' }).some(
      (button) => button.getAttribute('aria-pressed') === 'true',
    )).toBe(true);
  });

  it('opens one brush panel with types, colors, and preset sizes', () => {
    const { onToolChange } = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.pen' }));

    expect(screen.getByRole('button', { name: 'whiteboard.tool.pencil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#000000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.brushSize 100%' })).toBeInTheDocument();
    const sizePreviews = document.querySelectorAll('[data-whiteboard-size-preview]');
    expect(sizePreviews).toHaveLength(5);
    expect(sizePreviews[0]).toHaveStyle({ height: '3px', width: '3px' });
    expect(sizePreviews[4]).toHaveStyle({ height: '12px', width: '12px' });
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.marker' }));
    expect(onToolChange).toHaveBeenCalledWith('marker');
  });

  it('applies a custom brush color only after confirmation', () => {
    const { onBrushColorChange } = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.pen' }));
    const customColor = screen.getByRole('button', { name: 'whiteboard.customColor' });
    expect(customColor).toHaveStyle({ backgroundImage: 'var(--vlaina-color-picker-rainbow)' });
    fireEvent.click(customColor);

    expect(document.querySelector('[data-slot="popover-content"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('HEX')).toHaveValue('#000000');
    fireEvent.change(screen.getByLabelText('HEX'), { target: { value: '#43a555' } });
    expect(onBrushColorChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'common.apply' }));
    expect(onBrushColorChange).toHaveBeenCalledWith('pen', '#43A555');
  });

  it('discards a custom brush color when cancelled', () => {
    const { onBrushColorChange } = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.pen' }));
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.customColor' }));
    fireEvent.change(screen.getByLabelText('HEX'), { target: { value: '#43a555' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(onBrushColorChange).not.toHaveBeenCalled();
  });

  it('renders enlarged controls at the bottom center and opens details above them', () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.pen' }));
    const panel = container.querySelector('[data-whiteboard-tool-panel="true"]');
    const mainToolbar = container.querySelector('[data-whiteboard-main-toolbar="true"]');
    const interactionRegion = mainToolbar?.parentElement;
    const placementRegion = interactionRegion?.parentElement;
    expect(mainToolbar?.closest('[data-whiteboard-titlebar-slot="true"]')).not.toBeInTheDocument();
    expect(interactionRegion).toHaveClass('app-no-drag', 'pointer-events-auto', 'max-w-full');
    expect(interactionRegion).not.toHaveClass('w-full');
    expect(placementRegion).toHaveClass('inset-x-0', 'top-3', 'justify-center');
    expect(panel?.parentElement).toHaveClass('w-max', 'max-w-full');
    expect(panel?.parentElement?.parentElement).toHaveClass('top-full', 'left-1/2', '-translate-x-1/2', 'w-max');
    expect(panel?.parentElement?.parentElement).not.toHaveClass('inset-x-2');
    expect(mainToolbar).toHaveClass('h-[var(--vlaina-size-56px)]', 'gap-1', 'px-1.5');
  });

  it('keeps the image action in the drawing tools group without a ruler action', () => {
    const { container } = renderToolbar();

    const mainToolbar = container.querySelector('[data-whiteboard-main-toolbar="true"]');
    const buttons = Array.from(mainToolbar?.querySelectorAll('button') ?? []);
    expect(buttons.some((button) => button.getAttribute('aria-label') === 'whiteboard.tool.ruler')).toBe(false);
    expect(buttons.at(-1)).toHaveAccessibleName('whiteboard.addImage');
  });

  it('places the hand tool first in the main toolbar', () => {
    const { container } = renderToolbar();
    const mainToolbar = container.querySelector('[data-whiteboard-main-toolbar="true"]');
    const firstButton = mainToolbar?.querySelector('button');

    expect(firstButton).toHaveAccessibleName('whiteboard.tool.hand');
  });

  it('highlights the hand tool while space temporarily enables panning', () => {
    renderToolbar({ spacePressed: true, tool: 'select' });

    expect(screen.getByRole('button', { name: 'whiteboard.tool.hand' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'whiteboard.tool.select' }).every(
      (button) => button.getAttribute('aria-pressed') !== 'true',
    )).toBe(true);
  });

  it('opens the native image picker from the add image action', () => {
    const originalShowPicker = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'showPicker');
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: showPicker });
    try {
      renderToolbar();
      fireEvent.click(screen.getByRole('button', { name: 'whiteboard.addImage' }));
      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (originalShowPicker) Object.defineProperty(HTMLInputElement.prototype, 'showPicker', originalShowPicker);
      else Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
    }
  });

});
