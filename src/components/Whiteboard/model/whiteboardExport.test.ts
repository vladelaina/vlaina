import { describe, expect, it } from 'vitest';
import { createWhiteboardExportBlob } from './whiteboardExport';

describe('whiteboard export appearance', () => {
  it('exports note colors and edge-anchored directional connectors', async () => {
    const root = document.createElement('div');
    root.style.setProperty('--vlaina-color-whiteboard-canvas', '#ffffff');
    root.style.setProperty('--vlaina-color-whiteboard-connector', '#123456');
    root.style.setProperty('--vlaina-color-whiteboard-shape', '#eeeeee');
    root.style.setProperty('--vlaina-color-whiteboard-shape-border', '#999999');
    root.style.setProperty('--vlaina-color-whiteboard-note', '#fff000');
    root.style.setProperty('--vlaina-color-whiteboard-note-blue', '#abcdef');
    root.style.setProperty('--vlaina-color-subtle-border-strong', '#777777');
    root.style.setProperty('--vlaina-color-text-primary', '#111111');
    document.body.appendChild(root);

    try {
      const blob = await createWhiteboardExportBlob({
        connectors: [{ id: 'connector-1', fromId: 'note-1', toId: 'rect-1' }],
        elements: [
          { id: 'note-1', type: 'note', noteColor: 'blue', x: 0, y: 0, width: 100, height: 80, text: 'Note' },
          { id: 'rect-1', type: 'rect', x: 300, y: 0, width: 100, height: 80, text: '' },
        ],
        paper: 'grid',
        root,
        strokes: [],
      }, 'svg');
      const svg = await blob?.text();

      expect(svg).toContain('fill="#abcdef"');
      expect(svg).toContain('marker-end="url(#whiteboard-export-arrow)"');
      expect(svg).toContain('id="whiteboard-paper-pattern"');
      expect(svg).toContain('x1="156"');
      expect(svg).toContain('x2="356"');
    } finally {
      root.remove();
    }
  });
});
