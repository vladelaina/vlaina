import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const { app, screen } = electron;

export const DEFAULT_WINDOW_BOUNDS = Object.freeze({ width: 980, height: 640 });
export const WINDOW_STATE_WRITE_DELAY_MS = 250;

const MIN_RESTORED_WINDOW_WIDTH = 800;
const MIN_RESTORED_WINDOW_HEIGHT = 600;
const MAX_RESTORED_WINDOW_WIDTH = 8192;
const MAX_RESTORED_WINDOW_HEIGHT = 8192;
const MAX_WINDOW_DIMENSION_INPUT_CHARS = 64;
const MAX_WINDOW_STATE_JSON_BYTES = 64 * 1024;

function getWindowStatePath() {
  return path.join(app.getPath('userData'), '.vlaina', 'app', 'window', 'state.json');
}

function readFiniteWindowDimension(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.length <= MAX_WINDOW_DIMENSION_INPUT_CHARS) {
    const trimmed = value.trim();
    if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function normalizeStoredWindowBounds(bounds) {
  const widthValue = readFiniteWindowDimension(bounds?.width);
  const heightValue = readFiniteWindowDimension(bounds?.height);
  if (widthValue === null || heightValue === null) {
    return null;
  }

  const width = Math.round(widthValue);
  const height = Math.round(heightValue);
  return {
    width: Math.min(MAX_RESTORED_WINDOW_WIDTH, Math.max(MIN_RESTORED_WINDOW_WIDTH, width)),
    height: Math.min(MAX_RESTORED_WINDOW_HEIGHT, Math.max(MIN_RESTORED_WINDOW_HEIGHT, height)),
  };
}

export function clampWindowBoundsToCurrentDisplay(bounds) {
  try {
    const workAreaSize = screen?.getPrimaryDisplay?.()?.workAreaSize;
    const workAreaWidth = readFiniteWindowDimension(workAreaSize?.width);
    const workAreaHeight = readFiniteWindowDimension(workAreaSize?.height);
    if (workAreaWidth === null || workAreaHeight === null) {
      return bounds;
    }
    const maxWidth = Math.max(MIN_RESTORED_WINDOW_WIDTH, Math.round(workAreaWidth));
    const maxHeight = Math.max(MIN_RESTORED_WINDOW_HEIGHT, Math.round(workAreaHeight));

    return {
      width: Math.min(bounds.width, maxWidth),
      height: Math.min(bounds.height, maxHeight),
    };
  } catch {
    return bounds;
  }
}

export function readStoredWindowState() {
  try {
    const statePath = getWindowStatePath();
    const stats = fs.statSync(statePath);
    if (!stats.isFile() || stats.size > MAX_WINDOW_STATE_JSON_BYTES) {
      return null;
    }

    const content = fs.readFileSync(statePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_WINDOW_STATE_JSON_BYTES) {
      return null;
    }

    const payload = JSON.parse(content);
    const bounds = normalizeStoredWindowBounds(payload?.bounds);
    if (!bounds) {
      return null;
    }

    return {
      bounds,
      isMaximized: Boolean(payload?.isMaximized),
    };
  } catch {
    return null;
  }
}

export function writeStoredWindowState(state) {
  let tempStatePath = null;
  try {
    const statePath = getWindowStatePath();
    tempStatePath = `${statePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(tempStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tempStatePath, statePath);
  } catch (error) {
    if (tempStatePath) {
      try {
        fs.rmSync(tempStatePath, { force: true });
      } catch {
      }
    }
    console.warn('[vlaina] Failed to persist window state:', error);
  }
}

export function captureWindowState(window) {
  const bounds = window.isMaximized() || window.isFullScreen?.() || window.isMinimized?.()
    ? window.getNormalBounds()
    : window.getBounds();
  const normalizedBounds = normalizeStoredWindowBounds(bounds);
  if (!normalizedBounds) {
    return null;
  }

  return {
    bounds: normalizedBounds,
    isMaximized: window.isMaximized(),
  };
}
