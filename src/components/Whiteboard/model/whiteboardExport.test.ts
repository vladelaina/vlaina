import { describe, expect, it } from 'vitest';
import { createWhiteboardExportBlob } from './whiteboardExport';

describe('whiteboard export appearance', () => {
  it('exports images on the selected paper background', async () => {
    const root = document.createElement('div');
    root.style.setProperty('--vlaina-bg-primary', '#ffffff');
    document.body.appendChild(root);

    try {
      const blob = await createWhiteboardExportBlob({
        elements: [{ id: 'image-1', imageSrc: 'data:image/png;base64,demo', type: 'image', x: 0, y: 0, width: 100, height: 80, text: 'demo.png' }],
        paper: 'dots',
        root,
        strokes: [],
      }, 'svg');
      const svg = await blob?.text();

      expect(svg).toContain('<image href="data:image/png;base64,demo"');
      expect(svg).toContain('id="whiteboard-paper-pattern"');
      expect(svg).toContain('width="20" height="20" patternUnits="userSpaceOnUse"');
      expect(svg).toContain('cx="0.65" cy="0.65" r="0.65"');
    } finally {
      root.remove();
    }
  });

  it('preserves material-specific brush layers in exported SVG', async () => {
    const root = document.createElement('div');
    root.style.setProperty('--vlaina-bg-primary', '#ffffff');
    document.body.appendChild(root);
    const points = [{ pressure: 0.4, x: 0, y: 0 }, { pressure: 0.8, x: 30, y: 10 }];

    try {
      const blob = await createWhiteboardExportBlob({
        elements: [],
        paper: 'blank',
        root,
        strokes: [
          { color: '#111111', id: 'pencil', points, size: 1, tool: 'pencil' },
          { color: '#22aa44', id: 'marker', points: points.map((point) => ({ ...point, y: point.y + 30 })), size: 1, tool: 'marker' },
          { color: '#3344aa', id: 'fountain', points: points.map((point) => ({ ...point, y: point.y + 60 })), size: 1, tool: 'fountain' },
          { color: '#ffaa00', id: 'marker-dot', points: [{ pressure: 0.7, x: 80, y: 20 }], size: 1, tool: 'marker' },
        ],
      }, 'svg');
      const svg = await blob?.text();

      expect(svg).toContain('data-whiteboard-brush="pencil"');
      expect(svg).toContain('stroke-dashoffset="');
      expect(svg).toContain('data-whiteboard-brush="marker"');
      expect(svg).toContain('stroke-linecap="butt"');
      expect(svg).toContain('data-whiteboard-brush="fountain"');
      expect(svg).toContain('data-whiteboard-brush-dab="marker"');
      expect(svg).toContain('transform="rotate(90 80 20)"');
      expect(svg?.match(/d="M 0 0 L 30 10"/g)?.length).toBeGreaterThan(1);
    } finally {
      root.remove();
    }
  });

});
