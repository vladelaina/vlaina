import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiDropdownController } from './AiDropdown';

vi.mock('./ai-dropdown/actions', () => ({
  bindAiDropdownInteractions: vi.fn(),
}));

vi.mock('./ai-dropdown/markup', () => ({
  createAiDropdownMarkup: () => `
    <div class="ai-dropdown-root">
      <button type="button">Root action</button>
    </div>
    <div class="ai-dropdown-panels">
      <div class="ai-dropdown-panel active">
        <div class="ai-dropdown-children">
          <button type="button">Child action</button>
        </div>
      </div>
    </div>
  `,
}));

function setScrollMetrics(element: HTMLElement, metrics: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop?: number;
}) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight,
  });

  let currentScrollTop = metrics.scrollTop ?? 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
}

describe('AiDropdownController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('leaves wheel scrolling in menu panels to the browser', () => {
    const controller = createAiDropdownController();
    const container = document.createElement('div');
    document.body.append(container);

    controller.render(container, {} as never, vi.fn());

    const scrollRoot = container.querySelector<HTMLElement>('.ai-dropdown-root');
    expect(scrollRoot).not.toBeNull();
    setScrollMetrics(scrollRoot!, { clientHeight: 120, scrollHeight: 480, scrollTop: 24 });

    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    scrollRoot!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(scrollRoot!.scrollTop).toBe(24);

    controller.destroy();
  });
});
