import { describe, expect, it } from 'vitest';
import type { WhiteboardElement, WhiteboardStroke } from './whiteboardModel';
import { getElementsInLasso, getStrokesInLasso } from './whiteboardSelection';

const lasso = [
  { x: 0, y: 0 },
  { x: 120, y: 0 },
  { x: 120, y: 120 },
  { x: 0, y: 120 },
];

describe('whiteboard lasso selection', () => {
  it('selects elements inside the lasso path', () => {
    const elements: WhiteboardElement[] = [
      { height: 40, id: 'inside', text: '', type: 'rect', width: 40, x: 40, y: 40 },
      { height: 40, id: 'outside', text: '', type: 'rect', width: 40, x: 180, y: 40 },
    ];

    expect(getElementsInLasso(elements, lasso)).toEqual(['inside']);
  });

  it('selects strokes crossing the lasso path', () => {
    const strokes: WhiteboardStroke[] = [
      {
        color: '#111111',
        id: 'crossing',
        points: [
          { pressure: 0.5, x: -20, y: 60 },
          { pressure: 0.5, x: 60, y: 60 },
        ],
        size: 1,
        tool: 'pen',
      },
      {
        color: '#111111',
        id: 'outside',
        points: [
          { pressure: 0.5, x: 160, y: 60 },
          { pressure: 0.5, x: 220, y: 60 },
        ],
        size: 1,
        tool: 'pen',
      },
    ];

    expect(getStrokesInLasso(strokes, lasso)).toEqual(['crossing']);
  });
});
