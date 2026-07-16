import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { WhiteboardEraserTrail } from './WhiteboardEraserTrail';

describe('WhiteboardEraserTrail', () => {
  it('renders a smooth tapered shape that follows the recent pointer path', () => {
    const { container } = render(<WhiteboardEraserTrail trail={[
      { point: { x: 10, y: 20 }, size: 1 },
      { point: { x: 20, y: 24 }, size: 1 },
      { point: { x: 30, y: 40 }, size: 1 },
    ]} zoom={1} />);

    const trail = container.querySelector('path[data-whiteboard-eraser-trail="true"]');
    expect(trail?.getAttribute('d')).toContain('Q');
    expect(trail?.getAttribute('d')).toMatch(/Z$/);
    expect(trail).toHaveAttribute('fill', 'var(--vlaina-color-whiteboard-eraser-trail)');
    expect(trail).toHaveAttribute('opacity', String(themeWhiteboardTokens.eraserTrailOpacity));
    expect(trail).not.toHaveAttribute('transform');
  });

  it('renders a round head before the pointer has produced a tail', () => {
    const { container } = render(<WhiteboardEraserTrail trail={[
      { point: { x: 20, y: 30 }, size: 1 },
    ]} zoom={1} />);

    expect(container.querySelector('circle[data-whiteboard-eraser-trail="true"]'))
      .toHaveAttribute('r', String(themeWhiteboardTokens.eraserTrailWidthPx / 2));
  });
});
