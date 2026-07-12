import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import {
  WHITEBOARD_DEFAULT_BRUSH_COLORS,
  WHITEBOARD_DEFAULT_BRUSH_SIZES,
} from '../model/whiteboardModel';

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

function renderToolbar(selectedNoteColor: 'yellow' | 'blue' | null = null) {
  const onNoteColorChange = vi.fn();
  const rendered = render(
    <WhiteboardToolbar
      canRedo={false}
      canUndo={false}
      brushColors={WHITEBOARD_DEFAULT_BRUSH_COLORS}
      brushSizes={WHITEBOARD_DEFAULT_BRUSH_SIZES}
      tool="select"
      viewport={{ x: 0, y: 0, zoom: 1 }}
      selectedNoteColor={selectedNoteColor}
      onBrushColorChange={vi.fn()}
      onBrushSizeChange={vi.fn()}
      onClear={vi.fn()}
      onCopy={vi.fn()}
      onDuplicate={vi.fn()}
      onExport={vi.fn()}
      onFitView={vi.fn()}
      onImageAdd={vi.fn()}
      onNoteColorChange={onNoteColorChange}
      onPaste={vi.fn()}
      onRedo={vi.fn()}
      onResetView={vi.fn()}
      onToolChange={vi.fn()}
      onUndo={vi.fn()}
      onZoomChange={vi.fn()}
    />,
  );
  return { onNoteColorChange, ...rendered };
}

describe('WhiteboardToolbar', () => {
  it('exposes the editable object tools', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'whiteboard.tool.note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.tool.rect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.tool.ellipse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'whiteboard.tool.connector' })).toBeInTheDocument();
  });

  it('opens the native image picker from the add image action', () => {
    const originalShowPicker = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'showPicker');
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    try {
      renderToolbar();

      fireEvent.click(screen.getByRole('button', { name: 'whiteboard.addImage' }));

      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (originalShowPicker) {
        Object.defineProperty(HTMLInputElement.prototype, 'showPicker', originalShowPicker);
      } else {
        Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
      }
    }
  });

  it('shows and applies note colors for a selected note', () => {
    const { onNoteColorChange } = renderToolbar('yellow');

    expect(screen.getByRole('button', { name: 'yellow' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'blue' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'blue' }));
    expect(onNoteColorChange).toHaveBeenCalledWith('blue');
  });
});
