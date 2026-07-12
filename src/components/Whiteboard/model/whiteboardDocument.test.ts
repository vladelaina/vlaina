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
  connectors: [{ fromId: 'note-1', id: 'connector-1', toId: 'rect-1' }],
  elements: [
    {
      height: 120,
      id: 'note-1',
      noteColor: 'blue',
      text: 'Plan',
      type: 'note',
      width: 180,
      x: 10,
      y: 20,
    },
    {
      height: 80,
      id: 'rect-1',
      text: 'Ship',
      type: 'rect',
      width: 160,
      x: 300,
      y: 140,
    },
  ],
  paper: 'ruled',
  ruler: { angle: 12, visible: true, x: 50, y: 60 },
  strokes: [
    {
      color: '#111111',
      id: 'stroke-1',
      points: [
        { pressure: 0.4, x: 1, y: 2 },
        { breakBefore: true, pressure: 0.8, x: 3, y: 4 },
      ],
      size: 2,
      tool: 'pen',
    },
  ],
  viewport: { x: 12, y: 24, zoom: 1.25 },
};

const serializedContent = {
  ...snapshot,
  strokes: [
    {
      ...snapshot.strokes[0],
      points: [
        [1, 2, 0.4],
        [3, 4, 0.8, true],
      ],
    },
  ],
};

describe('whiteboard document format', () => {
  it('serializes snapshots as versioned JSON documents', () => {
    const document = JSON.parse(serializeWhiteboardSnapshot(snapshot));

    expect(WHITEBOARD_DOCUMENT_MIME_TYPE).toBe('application/vnd.vlaina.whiteboard+json');
    expect(document).toEqual({
      content: serializedContent,
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    });
  });

  it('deserializes versioned documents', () => {
    expect(deserializeWhiteboardSnapshot(serializeWhiteboardSnapshot(snapshot))).toEqual(snapshot);
  });

  it('rejects raw snapshots without the current document envelope', () => {
    expect(deserializeWhiteboardSnapshot(JSON.stringify(snapshot))).toBeNull();
  });

  it('does not decode object-based stroke points', () => {
    expect(deserializeWhiteboardSnapshot(JSON.stringify({
      content: snapshot,
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    }))?.strokes).toEqual([]);
  });

  it('stores whiteboard asset image references without duplicating preview data URLs', () => {
    const document = JSON.parse(serializeWhiteboardSnapshot({
      ...snapshot,
      elements: [{
        height: 80,
        id: 'image-1',
        imageAssetPath: 'assets/demo.png',
        imageSrc: 'data:image/png;base64,preview',
        text: 'demo.png',
        type: 'image',
        width: 100,
        x: 1,
        y: 2,
      }],
    }));

    expect(document.content.elements[0]).toMatchObject({
      imageAssetPath: 'assets/demo.png',
      type: 'image',
    });
    expect(document.content.elements[0]).not.toHaveProperty('imageSrc');
  });

  it('drops malformed content instead of loading invalid board state', () => {
    const parsed = deserializeWhiteboardSnapshot(JSON.stringify({
      content: {
        connectors: [
          { fromId: 'missing', id: 'bad-connector', toId: 'note-1' },
          { fromId: 'note-1', id: 'good-connector', toId: 'rect-1' },
        ],
        elements: [
          snapshot.elements[0],
          snapshot.elements[1],
          { height: 20, id: 'bad-element', text: 'Bad', type: 'unknown', width: 20, x: 0, y: 0 },
        ],
        strokes: [
          serializedContent.strokes[0],
          { color: '#222222', id: 'bad-stroke', points: [], size: 1, tool: 'pen' },
        ],
        viewport: { x: 0, y: 0, zoom: 999 },
      },
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    }));

    expect(parsed?.elements).toEqual(snapshot.elements);
    expect(parsed?.connectors).toEqual([{ fromId: 'note-1', id: 'good-connector', toId: 'rect-1' }]);
    expect(parsed?.strokes).toEqual(snapshot.strokes);
    expect(parsed?.viewport.zoom).toBeLessThan(999);
  });

  it('rejects unknown documents and malformed JSON', () => {
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
    }))).toEqual({
      connectors: [],
      elements: [],
      strokes: [],
      viewport: WHITEBOARD_INITIAL_VIEWPORT,
    });
  });
});
