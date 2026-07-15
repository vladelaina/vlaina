import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WHITEBOARD_DEFAULT_BRUSH_COLORS, WHITEBOARD_DEFAULT_BRUSH_SIZES } from '../model/whiteboardModel';

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
  const onBrushSizeSelect = vi.fn();
  const onToolChange = vi.fn();
  const rendered = render(
    <WhiteboardToolbar
        active
        brushColors={WHITEBOARD_DEFAULT_BRUSH_COLORS}
        brushSizes={WHITEBOARD_DEFAULT_BRUSH_SIZES}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onBrushColorChange={vi.fn()}
        onBrushSizeSelect={onBrushSizeSelect}
        onFitView={vi.fn()}
        onImageAdd={vi.fn()}
        onResetView={vi.fn()}
        onToolChange={onToolChange}
        onZoomChange={vi.fn()}
        {...overrides}
    />,
  );
  return { onBrushSizeSelect, onToolChange, ...rendered };
}

describe('WhiteboardToolbar', () => {
  it('renders only while the whiteboard is active', () => {
    const props = {
      active: true,
      brushColors: WHITEBOARD_DEFAULT_BRUSH_COLORS,
      brushSizes: WHITEBOARD_DEFAULT_BRUSH_SIZES,
      tool: 'select' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      onBrushColorChange: vi.fn(),
      onBrushSizeSelect: vi.fn(),
      onFitView: vi.fn(),
      onImageAdd: vi.fn(),
      onResetView: vi.fn(),
      onToolChange: vi.fn(),
      onZoomChange: vi.fn(),
    };
    const { rerender } = render(<WhiteboardToolbar {...props} active={false} />);
    expect(screen.queryByRole('button', { name: 'whiteboard.zoomOut' })).not.toBeInTheDocument();
    rerender(<WhiteboardToolbar {...props} />);
    expect(screen.getByRole('button', { name: 'whiteboard.zoomOut' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '#27272a' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.brushSize 100%' })).toBeInTheDocument();
    const sizePreviews = document.querySelectorAll('[data-whiteboard-size-preview]');
    expect(sizePreviews).toHaveLength(5);
    expect(sizePreviews[0]).toHaveStyle({ height: '3px', width: '3px' });
    expect(sizePreviews[4]).toHaveStyle({ height: '12px', width: '12px' });
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.marker' }));
    expect(onToolChange).toHaveBeenCalledWith('marker');
  });

  it('renders enlarged controls at the bottom center and opens details above them', () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'whiteboard.tool.pen' }));
    const panel = container.querySelector('[data-whiteboard-tool-panel="true"]');
    const mainToolbar = container.querySelector('[data-whiteboard-main-toolbar="true"]');
    const interactionRegion = mainToolbar?.parentElement;
    const placementRegion = interactionRegion?.parentElement;
    expect(mainToolbar?.closest('[data-whiteboard-titlebar-slot="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.zoomOut' })).toBeInTheDocument();
    expect(interactionRegion).toHaveClass('app-no-drag', 'pointer-events-auto', 'max-w-full');
    expect(interactionRegion).not.toHaveClass('w-full');
    expect(placementRegion).toHaveClass('inset-x-0', 'bottom-4', 'justify-center');
    expect(panel?.parentElement).toHaveClass('w-max', 'max-w-full');
    expect(panel?.parentElement?.parentElement).toHaveClass('bottom-full', 'left-1/2', '-translate-x-1/2', 'w-max');
    expect(panel?.parentElement?.parentElement).not.toHaveClass('inset-x-2');
    expect(mainToolbar).toHaveClass('h-10', 'gap-1.5', 'px-2');
    expect(screen.getByRole('button', { name: 'whiteboard.zoomOut' })).toHaveClass('size-[var(--vlaina-size-36px)]');
  });

  it('keeps the image action immediately after the ruler', () => {
    const { container } = renderToolbar();

    const mainToolbar = container.querySelector('[data-whiteboard-main-toolbar="true"]');
    const buttons = Array.from(mainToolbar?.querySelectorAll('button') ?? []);
    const rulerIndex = buttons.findIndex((button) => button.getAttribute('aria-label') === 'whiteboard.tool.ruler');
    expect(buttons[rulerIndex + 1]).toHaveAccessibleName('whiteboard.addImage');
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
