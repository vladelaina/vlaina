import '@testing-library/jest-dom';
import { vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const emptyRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

if (typeof Range !== 'undefined') {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => emptyRect,
  });

  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () =>
      Object.assign([emptyRect], {
        item: (index: number) => (index === 0 ? emptyRect : null),
      }),
  });
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class OffscreenCanvasMock {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 }),
    };
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('OffscreenCanvas', OffscreenCanvasMock);

if (typeof window !== 'undefined') {
  if (typeof globalThis.addEventListener === 'undefined') {
    vi.stubGlobal('addEventListener', window.addEventListener.bind(window));
  }
  if (typeof globalThis.removeEventListener === 'undefined') {
    vi.stubGlobal('removeEventListener', window.removeEventListener.bind(window));
  }
  if (typeof window.HTMLTableRowElement !== 'undefined') {
    vi.stubGlobal('HTMLTableRowElement', window.HTMLTableRowElement);
  }
  if (typeof window.HTMLTableCellElement !== 'undefined') {
    vi.stubGlobal('HTMLTableCellElement', window.HTMLTableCellElement);
  }
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 }),
    }),
  });
}
