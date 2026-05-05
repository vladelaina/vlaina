import { describe, expect, it } from 'vitest';
import { createInitialState } from './floatingToolbarState';
import {
  getAiReviewPanelWidth,
  resolveToolbarViewportPosition,
  type ContentLayoutContext,
} from './floatingToolbarLayout';

function createLayout(): ContentLayoutContext {
  return {
    contentRoot: null,
    contentElement: document.createElement('div'),
    container: null,
    containerRect: null,
    contentRect: new DOMRect(0, 0, 800, 600),
    paddingLeft: 0,
    paddingRight: 0,
    viewportBounds: {
      left: 0,
      right: 800,
    },
    containerBounds: null,
  };
}

describe('floatingToolbarLayout', () => {
  it('keeps the current selection placement when opening the ai submenu', () => {
    const pluginState = {
      ...createInitialState(),
      subMenu: 'ai' as const,
    };

    const selectionPosition = {
      x: 320,
      y: 24,
      placement: 'top' as const,
    };

    const result = resolveToolbarViewportPosition({
      aiPosition: {
        x: 80,
        y: 420,
        placement: 'bottom',
      },
      layout: createLayout(),
      pluginState,
      selectionPosition,
    });

    expect(result).toEqual(selectionPosition);
  });

  it('keeps the ai review panel at the top while the selection toolbar is pinned to the top', () => {
    const pluginState = {
      ...createInitialState(),
      subMenu: 'aiReview' as const,
    };

    const result = resolveToolbarViewportPosition({
      aiPosition: {
        x: 120,
        y: 420,
        placement: 'bottom',
      },
      layout: createLayout(),
      pluginState,
      selectionPosition: {
        x: 320,
        y: 24,
        placement: 'top',
      },
    });

    expect(result).toEqual({
      x: 0,
      y: 24,
      placement: 'top',
    });
  });

  it('moves the ai review panel back to the bottom anchor once the selection bottom is in view', () => {
    const pluginState = {
      ...createInitialState(),
      subMenu: 'aiReview' as const,
    };

    const result = resolveToolbarViewportPosition({
      aiPosition: {
        x: 120,
        y: 420,
        placement: 'bottom',
      },
      layout: createLayout(),
      pluginState,
      selectionPosition: {
        x: 320,
        y: 160,
        placement: 'bottom',
      },
    });

    expect(result).toEqual({
      x: 0,
      y: 420,
      placement: 'bottom',
    });
  });

  it('sizes the ai review panel from the content area instead of the selected block', () => {
    const layout = createLayout();
    layout.viewportBounds = {
      left: 120,
      right: 680,
    };

    expect(getAiReviewPanelWidth(layout)).toBe(560);
  });
});
