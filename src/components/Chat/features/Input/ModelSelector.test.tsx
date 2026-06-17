import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ModelSelector,
  compareModelSelectorProviderIds,
  createModelSelectorProviderOrder,
} from './ModelSelector';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';

const mocks = vi.hoisted(() => ({
  refreshManagedProviderInBackground: vi.fn(),
  selectModel: vi.fn(),
  updateModel: vi.fn(),
}));

vi.mock('@/stores/useAIStore', () => ({
  actions: {
    refreshManagedProviderInBackground: mocks.refreshManagedProviderInBackground,
    selectModel: mocks.selectModel,
    updateModel: mocks.updateModel,
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: (index: number) => number;
  }) => {
    const sizes = Array.from({ length: count }, (_, index) => estimateSize(index));
    return {
      getTotalSize: () => sizes.reduce((total, size) => total + size, 0),
      getVirtualItems: () => sizes.map((size, index) => ({
        index,
        size,
        start: sizes.slice(0, index).reduce((total, previousSize) => total + previousSize, 0),
      })),
      measure: vi.fn(),
      scrollToIndex: vi.fn(),
    };
  },
}));

function createRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setModelFixture() {
  useUnifiedStore.setState((state) => ({
    loaded: true,
    data: {
      ...state.data,
      ai: {
        ...state.data.ai!,
        providers: [
          {
            id: 'provider-a',
            name: 'Provider A',
            type: 'newapi',
            apiHost: 'https://example.com/v1',
            apiKey: 'key',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        models: [
          {
            id: 'model-alpha',
            apiModelId: 'model-alpha',
            name: 'Model Alpha',
            providerId: 'provider-a',
            enabled: true,
            createdAt: 1,
          },
        ],
        selectedModelId: 'model-alpha',
      },
    },
  }));
}

function setProviderOrderFixture() {
  useUnifiedStore.setState((state) => ({
    loaded: true,
    data: {
      ...state.data,
      ai: {
        ...state.data.ai!,
        providers: [
          {
            id: 'provider-b',
            name: 'Provider B',
            type: 'newapi',
            apiHost: 'https://b.example.com/v1',
            apiKey: 'key-b',
            enabled: true,
            createdAt: 2,
            updatedAt: 2,
          },
          {
            id: 'provider-a',
            name: 'Provider A',
            type: 'newapi',
            apiHost: 'https://a.example.com/v1',
            apiKey: 'key-a',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        models: [
          {
            id: 'model-a',
            apiModelId: 'zzz-custom',
            name: 'Model A',
            providerId: 'provider-a',
            enabled: true,
            createdAt: 1,
          },
          {
            id: 'model-b',
            apiModelId: 'aaa-custom',
            name: 'Model B',
            providerId: 'provider-b',
            enabled: true,
            createdAt: 2,
          },
        ],
        selectedModelId: 'model-b',
      },
    },
  }));
}

describe('ModelSelector', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setModelFixture();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this.getAttribute('data-model-selector-dropdown') === 'true') {
        return createRect({ left: 0, top: 0, width: 432, height: 360 });
      }

      const className = this.getAttribute('class') ?? '';
      if (className.includes('relative select-none w-fit')) {
        return createRect({ left: 620, top: 520, width: 120, height: 32 });
      }

      if (className.includes('relative min-h-0 overflow-hidden min-w-0 flex-1')) {
        return createRect({ left: 0, top: 0, width: 360, height: 386 });
      }

      return createRect({ left: 0, top: 0, width: 0, height: 0 });
    });
  });

  afterEach(() => {
    cleanup();
    rectSpy.mockRestore();
  });

  it('ports embedded top dropdowns to the body above the trigger with the requested layer', async () => {
    render(
      <ModelSelector
        dropdownLayerClassName="z-[var(--vlaina-z-120)]"
        dropdownPlacement="top"
        isEmbedded
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Model Alpha/ }));

    await waitFor(() => {
      const dropdown = document.querySelector<HTMLElement>('[data-model-selector-dropdown="true"]');
      expect(dropdown).not.toBeNull();
      expect(dropdown!.parentElement).toBe(document.body);
      expect(dropdown!.className).toContain('fixed');
      expect(dropdown!.className).toContain('z-[var(--vlaina-z-120)]');
      expect(dropdown!.className).not.toContain('z-[var(--vlaina-z-50)]');
      expect(Number.parseFloat(dropdown!.style.left)).toBe(308);
      expect(Number.parseFloat(dropdown!.style.top)).toBe(156);
    });

    expect(mocks.refreshManagedProviderInBackground).toHaveBeenCalledWith({ force: true });
  });

  it('coalesces embedded dropdown scroll repositioning into one frame', async () => {
    let pendingFrame: FrameRequestCallback | null = null;

    render(
      <ModelSelector
        dropdownPlacement="top"
        isEmbedded
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Model Alpha/ }));

    await waitFor(() => {
      expect(document.querySelector('[data-model-selector-dropdown="true"]')).not.toBeNull();
    });

    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        pendingFrame = callback;
        return 12;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    try {
      fireEvent.scroll(window);
      fireEvent.scroll(window);
      fireEvent.scroll(window);

      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

      act(() => {
        pendingFrame?.(16);
      });
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('shows the custom model box icon for unmatched models in the list', async () => {
    render(<ModelSelector />);

    fireEvent.click(screen.getByRole('button', { name: /Model Alpha/ }));

    await waitFor(() => {
      expect(document.querySelector('[data-model-selector-dropdown="true"]')).not.toBeNull();
      expect(document.querySelectorAll('[data-model-selector-custom-icon="true"]').length).toBeGreaterThanOrEqual(3);
    });
  });

  it('orders custom provider sections by the saved provider order', () => {
    setProviderOrderFixture();
    const providers = useUnifiedStore.getState().data.ai?.providers ?? [];
    const providerOrder = createModelSelectorProviderOrder(providers);

    expect(
      ['provider-a', 'provider-b'].sort((leftProviderId, rightProviderId) =>
        compareModelSelectorProviderIds(providerOrder, leftProviderId, rightProviderId)
      )
    ).toEqual(['provider-b', 'provider-a']);
  });

  it('keeps managed provider sections after user providers', () => {
    const providerOrder = createModelSelectorProviderOrder([
      { id: MANAGED_PROVIDER_ID },
      { id: 'provider-b' },
      { id: 'provider-a' },
    ]);

    expect(
      ['provider-a', MANAGED_PROVIDER_ID, 'provider-b'].sort((leftProviderId, rightProviderId) =>
        compareModelSelectorProviderIds(providerOrder, leftProviderId, rightProviderId)
      )
    ).toEqual(['provider-b', 'provider-a', MANAGED_PROVIDER_ID]);
  });
});
