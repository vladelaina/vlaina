import { describe, expect, it } from 'vitest';
import { WHITEBOARD_INITIAL_VIEWPORT } from './whiteboardModel';
import {
  WHITEBOARD_DOCUMENT_FORMAT,
  WHITEBOARD_DOCUMENT_MIME_TYPE,
  WHITEBOARD_DOCUMENT_VERSION,
  deserializeWhiteboardSnapshot,
  serializeWhiteboardSnapshot,
  type WhiteboardSnapshot,
} from './whiteboardDocument';

const snapshot: WhiteboardSnapshot = {
  elements: [{
    height: 80,
    id: 'image-1',
    imageSrc: 'data:image/png;base64,preview',
    text: 'demo.png',
    type: 'image',
    width: 100,
    x: 10,
    y: 20,
  }],
  paper: 'ruled',
  ruler: { angle: 12, visible: true, x: 50, y: 60 },
  strokes: [{
    color: '#111111',
    id: 'stroke-1',
    points: [{ pressure: 0.4, x: 1, y: 2 }, { breakBefore: true, pressure: 0.8, x: 3, y: 4 }],
    size: 2,
    tool: 'pen',
  }],
  viewport: { x: 12, y: 24, zoom: 1.25 },
};

describe('whiteboard document format', () => {
  it('serializes and deserializes current whiteboard content', () => {
    const serialized = serializeWhiteboardSnapshot(snapshot);
    const document = JSON.parse(serialized);
    expect(WHITEBOARD_DOCUMENT_MIME_TYPE).toBe('application/vnd.vlaina.whiteboard+json');
    expect(document.format).toBe(WHITEBOARD_DOCUMENT_FORMAT);
    expect(document.version).toBe(WHITEBOARD_DOCUMENT_VERSION);
    expect(deserializeWhiteboardSnapshot(serialized)).toEqual(snapshot);
  });

  it('stores asset paths without duplicating preview data URLs', () => {
    const document = JSON.parse(serializeWhiteboardSnapshot({
      ...snapshot,
      elements: [{ ...snapshot.elements[0], imageAssetPath: 'assets/demo.png' }],
    }));
    expect(document.content.elements[0]).toMatchObject({ imageAssetPath: 'assets/demo.png', type: 'image' });
    expect(document.content.elements[0]).not.toHaveProperty('imageSrc');
  });

  it('drops removed object types instead of restoring obsolete content', () => {
    const parsed = deserializeWhiteboardSnapshot(JSON.stringify({
      content: {
        elements: [
          snapshot.elements[0],
          { height: 80, id: 'old-note', text: 'Old', type: 'note', width: 100, x: 0, y: 0 },
          { height: 80, id: 'old-shape', text: '', type: 'rect', width: 100, x: 0, y: 0 },
        ],
        strokes: [],
        viewport: WHITEBOARD_INITIAL_VIEWPORT,
      },
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    }));
    expect(parsed?.elements).toEqual([snapshot.elements[0]]);
    expect(parsed).not.toHaveProperty('connectors');
  });

  it('rejects raw snapshots, unknown documents, and malformed JSON', () => {
    expect(deserializeWhiteboardSnapshot(JSON.stringify(snapshot))).toBeNull();
    expect(deserializeWhiteboardSnapshot('not json')).toBeNull();
    expect(deserializeWhiteboardSnapshot(JSON.stringify({
      content: snapshot,
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION + 1,
    }))).toBeNull();
  });

  it('returns empty defaults for empty document content', () => {
    expect(deserializeWhiteboardSnapshot(JSON.stringify({
      content: {},
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    }))).toEqual({ elements: [], strokes: [], viewport: WHITEBOARD_INITIAL_VIEWPORT });
  });
});
