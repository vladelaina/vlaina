import { describe, expect, it, vi } from 'vitest';
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

  it('updates expanded model lists when the filter query changes', () => {
    const { rerender } = render(<ProviderModelsPanel {...buildProps()} />);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();

    rerender(
      <ProviderModelsPanel
        {...buildProps({
          modelQuery: 'b',
          filteredProviderModels: [],
          filteredFetchedModels: ['beta'],
        })}
      />,
    );

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('adds an available model when its row is clicked', () => {
    const onAddModel = vi.fn(() => true);

    render(<ProviderModelsPanel {...buildProps({ onAddModel })} />);

    fireEvent.click(screen.getByText('beta'));

    expect(onAddModel).toHaveBeenCalledWith('beta');
  });
});
