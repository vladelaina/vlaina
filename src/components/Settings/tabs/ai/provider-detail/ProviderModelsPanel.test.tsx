import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ChangeEventHandler,
  ComponentProps,
  FocusEventHandler,
  KeyboardEventHandler,
} from 'react';
import { ProviderModelsPanel } from './ProviderModelsPanel';
import type { AIModel } from '@/lib/ai/types';
import type { HealthStatus } from '../components/ModelListItem';

const measureMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 58,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 58,
        start: index * 58,
      })),
    measure: measureMock,
  }),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/components/Settings/components/SettingsFields', () => ({
  SettingsTextInput: ({
    value,
    onChange,
    placeholder,
    onFocus,
    onBlur,
    onKeyDown,
  }: {
    value?: string;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    onFocus?: FocusEventHandler<HTMLInputElement>;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  ),
}));

function buildModel(id: string, apiModelId = id): AIModel {
  return {
    id,
    apiModelId,
    name: apiModelId,
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
  };
}

function buildProps(overrides: Partial<ComponentProps<typeof ProviderModelsPanel>> = {}) {
  return {
    providerId: 'provider-1',
    providerModels: [buildModel('model-alpha', 'alpha')],
    filteredProviderModels: [buildModel('model-alpha', 'alpha')],
    sortedFetchedModels: ['alpha', 'beta'],
    filteredFetchedModels: ['alpha', 'beta'],
    providerModelIdSet: new Set(['alpha']),
    modelQuery: '',
    quickAddModelId: '',
    quickAddError: '',
    fetchError: '',
    isFetchingModels: false,
    canUseConnectionActions: true,
    canBenchmark: true,
    canBenchmarkSelected: true,
    canBenchmarkAvailable: true,
    isHealthChecking: false,
    benchmarkAllActive: false,
    selectedBenchmarkActive: false,
    availableBenchmarkActive: false,
    healthCheckOverall: 'idle' as const,
    healthStatus: {} as Record<string, HealthStatus>,
    onQuickAddModelIdChange: vi.fn(),
    onModelQueryChange: vi.fn(),
    onFetchModels: vi.fn(),
    onBenchmark: vi.fn(),
    onBenchmarkSelected: vi.fn(),
    onBenchmarkAvailable: vi.fn(),
    onClearAllModels: vi.fn(),
    onDeleteModel: vi.fn(),
    onAddModel: vi.fn(() => true),
    onAddAllVisible: vi.fn(),
    onSetQuickAddError: vi.fn(),
    ...overrides,
  };
}

describe('ProviderModelsPanel', () => {
  beforeEach(() => {
    measureMock.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows empty states when an active query matches nothing', () => {
    render(
      <ProviderModelsPanel
        {...buildProps({
          modelQuery: 'zzz',
          filteredProviderModels: [],
          filteredFetchedModels: [],
        })}
      />,
    );

    expect(screen.getByText('No selected models')).toBeInTheDocument();
    expect(screen.getByText('No available models')).toBeInTheDocument();
    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('beta')).not.toBeInTheDocument();
  });

  it('resets both virtual lists when the filter query changes', () => {
    const { rerender } = render(<ProviderModelsPanel {...buildProps()} />);

    vi.mocked(HTMLElement.prototype.scrollTo).mockClear();

    rerender(
      <ProviderModelsPanel
        {...buildProps({
          modelQuery: 'a',
          filteredProviderModels: [buildModel('model-alpha', 'alpha')],
          filteredFetchedModels: ['alpha', 'beta'],
        })}
      />,
    );

    const scrollToMock = vi.mocked(HTMLElement.prototype.scrollTo);
    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock).toHaveBeenNthCalledWith(1, { top: 0, behavior: 'auto' });
    expect(scrollToMock).toHaveBeenNthCalledWith(2, { top: 0, behavior: 'auto' });
  });

  it('adds an available model when its row is clicked', () => {
    const onAddModel = vi.fn(() => true);

    render(<ProviderModelsPanel {...buildProps({ onAddModel })} />);

    fireEvent.click(screen.getByText('beta'));

    expect(onAddModel).toHaveBeenCalledWith('beta');
  });
});
