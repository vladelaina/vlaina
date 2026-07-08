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

function renderToolbar() {
  const noop = vi.fn();
  return render(
    <WhiteboardToolbar
      canRedo={false}
      canUndo={false}
      brushColors={WHITEBOARD_DEFAULT_BRUSH_COLORS}
      brushSizes={WHITEBOARD_DEFAULT_BRUSH_SIZES}
      tool="select"
      viewport={{ x: 0, y: 0, zoom: 1 }}
      onBrushColorChange={noop}
      onBrushSizeChange={noop}
      onClear={noop}
      onCopy={noop}
      onDuplicate={noop}
      onExport={noop}
      onFitView={noop}
      onImageAdd={noop}
      onPaste={noop}
      onRedo={noop}
      onResetView={noop}
      onToolChange={noop}
      onUndo={noop}
      onZoomChange={noop}
    />,
  );
}

describe('WhiteboardToolbar', () => {
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
        delete HTMLInputElement.prototype.showPicker;
      }
    }
  });
});
