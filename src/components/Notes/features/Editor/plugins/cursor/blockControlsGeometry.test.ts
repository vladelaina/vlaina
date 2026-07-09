import { describe, expect, it } from 'vitest';
import type { HandleBlockTarget } from './blockControlsInteractionTypes';
import {
  BLOCK_CONTROLS_COLLAPSE_GAP_PX,
  BLOCK_CONTROLS_DRAG_SURFACE_PAD_X_PX,
  BLOCK_CONTROLS_LEFT_OFFSET_PX,
  setControlsPosition,
} from './blockControlsGeometry';

const BLOCK_CONTROL_BUTTON_SIZE_PX = 24;
const HEADING_COLLAPSE_LEFT_OFFSET_PX = 22;
const LIST_COLLAPSE_LEFT_OFFSET_PX = 46;

function createTarget(left: number, top: number, height: number, isListItem = true): HandleBlockTarget {
  return {
    pos: 0,
    isListItem,
    rect: {
      x: left,
      y: top,
      left,
      top,
      right: left + 100,
      bottom: top + height,
      width: 100,
      height,
      toJSON: () => ({}),
    } as DOMRect,
  };
}

describe('setControlsPosition', () => {
  it('uses the current target for both horizontal and vertical placement', () => {
    const controls = document.createElement('div');
    const nestedTarget = createTarget(128, 40, 20);

    setControlsPosition(controls, nestedTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    expect(controls.style.left).toBe('44px');
    expect(controls.style.top).toBe('38px');
  });

  it('uses an explicit horizontal anchor without changing the target row', () => {
    const controls = document.createElement('div');
    const outerParentTarget = createTarget(120, 0, 20);
    const nestedTarget = createTarget(128, 40, 20);

    setControlsPosition(controls, nestedTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX, { horizontalAnchor: outerParentTarget });

    expect(controls.style.left).toBe('36px');
    expect(controls.style.top).toBe('38px');
  });

  it('centers the controls against the target rect using the rendered controls height', () => {
    const controls = document.createElement('div');
    Object.defineProperty(controls, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        height: 32,
      }),
    });
    const target = createTarget(80, 40, 80, false);

    setControlsPosition(controls, target, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    expect(controls.style.top).toBe('64px');
  });

  it('keeps the handle clear of heading and list collapse toggles', () => {
    const headingControls = document.createElement('div');
    const headingTarget = createTarget(160, 40, 20, false);
    setControlsPosition(headingControls, headingTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    const headingControlsRight = Number.parseInt(headingControls.style.left, 10)
      + BLOCK_CONTROL_BUTTON_SIZE_PX
      + BLOCK_CONTROLS_DRAG_SURFACE_PAD_X_PX;
    const headingToggleLeft = headingTarget.rect.left - HEADING_COLLAPSE_LEFT_OFFSET_PX;
    expect(headingToggleLeft - headingControlsRight).toBeGreaterThanOrEqual(BLOCK_CONTROLS_COLLAPSE_GAP_PX);

    const listControls = document.createElement('div');
    const listTarget = createTarget(160, 80, 20, true);
    setControlsPosition(listControls, listTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    const listControlsRight = Number.parseInt(listControls.style.left, 10)
      + BLOCK_CONTROL_BUTTON_SIZE_PX
      + BLOCK_CONTROLS_DRAG_SURFACE_PAD_X_PX;
    const listToggleLeft = listTarget.rect.left - LIST_COLLAPSE_LEFT_OFFSET_PX;
    expect(listToggleLeft - listControlsRight).toBeGreaterThanOrEqual(BLOCK_CONTROLS_COLLAPSE_GAP_PX);
  });

  it('uses rendered collapse toggle geometry when large fonts move toggles farther left', () => {
    const controls = document.createElement('div');
    Object.defineProperty(controls, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        height: 24,
        width: BLOCK_CONTROL_BUTTON_SIZE_PX,
      }),
    });

    const heading = document.createElement('h1');
    const headingToggle = document.createElement('button');
    headingToggle.className = 'heading-toggle-btn';
    headingToggle.dataset.hasContent = 'true';
    Object.defineProperty(headingToggle, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        height: 18,
        left: 112,
        width: 18,
      }),
    });
    heading.appendChild(headingToggle);

    setControlsPosition(controls, {
      ...createTarget(160, 40, 20, false),
      element: heading,
    }, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    let controlsRight = Number.parseInt(controls.style.left, 10) + BLOCK_CONTROL_BUTTON_SIZE_PX;
    expect(112 - controlsRight).toBeGreaterThanOrEqual(BLOCK_CONTROLS_COLLAPSE_GAP_PX);

    const listItem = document.createElement('li');
    const listToggle = document.createElement('button');
    listToggle.className = 'editor-collapse-btn';
    listToggle.dataset.hasContent = 'true';
    Object.defineProperty(listToggle, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        height: 18,
        left: 52,
        width: 18,
      }),
    });
    listItem.appendChild(listToggle);

    setControlsPosition(controls, {
      ...createTarget(160, 80, 20, true),
      element: listItem,
    }, BLOCK_CONTROLS_LEFT_OFFSET_PX);

    controlsRight = Number.parseInt(controls.style.left, 10) + BLOCK_CONTROL_BUTTON_SIZE_PX;
    expect(52 - controlsRight).toBeGreaterThanOrEqual(BLOCK_CONTROLS_COLLAPSE_GAP_PX);
  });
});
