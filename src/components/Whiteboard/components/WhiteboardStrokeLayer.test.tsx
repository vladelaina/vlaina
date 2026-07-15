import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardDrawingTool, WhiteboardStroke } from '../model/whiteboardModel';
import { WhiteboardStrokeLayer } from './WhiteboardStrokeLayer';

function renderBrush(tool: WhiteboardDrawingTool) {
  const stroke: WhiteboardStroke = {
    color: '#334455',
    id: `${tool}-stroke`,
    points: [
      { pressure: 0.4, x: 0, y: 0 },
      { pressure: 0.9, x: 20, y: 8 },
      { pressure: 0.9, x: 40, y: 0 },
    ],
    size: 1,
    tool,
  };
  const { container } = render(<WhiteboardStrokeLayer strokes={[stroke]} />);
  return container.querySelector(`[data-whiteboard-brush="${tool}"]`)!;
}

describe('WhiteboardStrokeLayer brush rendering', () => {
  it('renders marker ink with a flat core and no round cap circles', () => {
    const marker = renderBrush('marker');

    expect(marker.querySelectorAll('circle')).toHaveLength(0);
    expect(marker.querySelectorAll('path')[1]).toHaveAttribute('stroke-linecap', 'butt');
  });

  it('uses two offset grain layers for pencil and crayon texture', () => {
    const pencil = renderBrush('pencil');
    const crayon = renderBrush('crayon');

    expect(pencil.querySelectorAll('path[stroke-dasharray]')).toHaveLength(2);
    expect(pencil.querySelectorAll('path[stroke-dashoffset]')).toHaveLength(2);
    expect(crayon.querySelectorAll('path[stroke-dasharray]')).toHaveLength(3);
    expect(crayon.querySelectorAll('path[stroke-dashoffset]')).toHaveLength(3);
  });

  it('layers pressure pigment into watercolor and fountain strokes', () => {
    const watercolor = renderBrush('watercolor');
    const fountain = renderBrush('fountain');

    expect(watercolor.querySelectorAll('path')).toHaveLength(5);
    expect(fountain.querySelectorAll('path')).toHaveLength(2);
    expect(fountain.querySelectorAll('circle')).toHaveLength(0);
  });

  it('uses material-specific marks for single-point strokes', () => {
    const createDot = (tool: WhiteboardDrawingTool) => ({
      color: '#334455',
      id: `${tool}-dot`,
      points: [{ pressure: 0.7, x: 20, y: 30 }],
      size: 1,
      tool,
    });
    const { container } = render(<WhiteboardStrokeLayer strokes={[
      createDot('marker'),
      createDot('fountain'),
      createDot('watercolor'),
      createDot('crayon'),
    ]} />);

    expect(container.querySelector('[data-whiteboard-brush-dab="marker"]')).toHaveAttribute('transform', 'rotate(90 20 30)');
    expect(container.querySelector('[data-whiteboard-brush-dab="fountain"]')).toHaveAttribute('transform', 'rotate(-42 20 30)');
    expect(container.querySelector('[data-whiteboard-brush-dab="watercolor"]')?.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelector('[data-whiteboard-brush-dab="crayon"]')?.querySelectorAll('circle')).toHaveLength(2);
  });

  it('dims complete strokes selected by an active erase gesture', () => {
    const stroke: WhiteboardStroke = {
      color: '#334455',
      id: 'target-stroke',
      points: [{ pressure: 0.5, x: 0, y: 0 }, { pressure: 0.5, x: 20, y: 0 }],
      size: 1,
      tool: 'pen',
    };
    const { container } = render(<WhiteboardStrokeLayer erasingStrokeIds={[stroke.id]} strokes={[stroke]} />);

    expect(container.querySelector(`[data-whiteboard-stroke="${stroke.id}"]`))
      .toHaveAttribute('opacity', String(themeWhiteboardTokens.eraserTargetPreviewOpacity));
  });
});
