import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WhiteboardBrushCursor } from './WhiteboardBrushCursor';

describe('WhiteboardBrushCursor', () => {
  it('renders a standalone point for the pen cursor', () => {
    const { container } = render(<WhiteboardBrushCursor color="#111111" point={{ x: 20, y: 30 }} size={1} tool="pen" />);
    const cursor = container.querySelector('[data-whiteboard-brush-cursor="pen"]');

    expect(cursor).toHaveAttribute('fill', '#111111');
    expect(cursor).toHaveAttribute('stroke', '#111111');
    expect(cursor).toHaveAttribute('opacity', '1');
    expect(container.querySelector('svg')).toHaveClass(
      'pointer-events-none',
      'hidden',
      'group-hover/whiteboard-surface:block',
    );
  });

  it('previews marker and fountain nib geometry', () => {
    const marker = render(<WhiteboardBrushCursor color="#ffaa00" point={{ x: 20, y: 30 }} size={1} tool="marker" />);
    const fountain = render(<WhiteboardBrushCursor color="#111111" point={{ x: 20, y: 30 }} size={1} tool="fountain" />);

    expect(marker.container.querySelector('[data-whiteboard-brush-cursor="marker"]')).toHaveAttribute('transform', 'rotate(90 20 30)');
    expect(fountain.container.querySelector('[data-whiteboard-brush-cursor="fountain"]')).toHaveAttribute('transform', 'rotate(-42 20 30)');
  });

  it('previews the outer watercolor wash', () => {
    const { container } = render(<WhiteboardBrushCursor color="#22aa88" point={{ x: 20, y: 30 }} size={1} tool="watercolor" />);

    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('shows the active size for the stroke eraser', () => {
    const { container } = render(<WhiteboardBrushCursor color="transparent" point={{ x: 20, y: 30 }} size={1} tool="stroke-eraser" />);

    expect(container.querySelector('[data-whiteboard-brush-cursor="stroke-eraser"]')).toHaveAttribute('r', '10');
  });
});
