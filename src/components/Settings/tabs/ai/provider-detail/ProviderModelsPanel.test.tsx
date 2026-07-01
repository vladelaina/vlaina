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
    fetchError: '' as const,
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

function setScrollMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop?: number },
) {
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

  it('adds a model directly when a quick add suggestion is clicked', () => {
    const onAddAllVisible = vi.fn();
    const onQuickAddModelIdChange = vi.fn();

    render(
      <ProviderModelsPanel
        {...buildProps({
          quickAddModelId: 'gm',
          sortedFetchedModels: ['alpha', 'gpt-4o-mini'],
          filteredFetchedModels: ['alpha', 'gpt-4o-mini'],
          onAddAllVisible,
          onQuickAddModelIdChange,
        })}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Add a model ID'));
    fireEvent.click(screen.getByText('gpt-4o-mini'));

    expect(onAddAllVisible).toHaveBeenCalledWith(['gpt-4o-mini']);
    expect(onQuickAddModelIdChange).toHaveBeenCalledWith('');
  });

  it('handles wheel scrolling on quick add suggestions', () => {
    render(
      <ProviderModelsPanel
        {...buildProps({
          quickAddModelId: 'g',
          sortedFetchedModels: ['gpt-4o', 'gpt-4o-mini', 'gemini-pro', 'grok-beta'],
          filteredFetchedModels: ['gpt-4o', 'gpt-4o-mini', 'gemini-pro', 'grok-beta'],
        })}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Add a model ID'));
    const scrollRoot = document.querySelector('[data-settings-scroll-root="ai-model-suggestions"]') as HTMLElement | null;
    expect(scrollRoot).not.toBeNull();

    setScrollMetrics(scrollRoot!, { clientHeight: 100, scrollHeight: 360, scrollTop: 0 });
    fireEvent.wheel(scrollRoot!, { deltaY: 90 });

    expect(scrollRoot!.scrollTop).toBe(90);
  });

  it('adds all visible available models from the available header', () => {
    const onAddAllVisible = vi.fn();

    render(
      <ProviderModelsPanel
        {...buildProps({
          sortedFetchedModels: ['alpha', 'beta', 'gamma'],
          filteredFetchedModels: ['alpha', 'beta', 'gamma'],
          onAddAllVisible,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add all' }));

    expect(onAddAllVisible).toHaveBeenCalledWith(['beta', 'gamma']);
  });

  it('removes all selected models from the selected header', () => {
    const onClearAllModels = vi.fn();

    render(<ProviderModelsPanel {...buildProps({ onClearAllModels })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove all' }));

    expect(onClearAllModels).toHaveBeenCalledTimes(1);
  });

  it('removes only visible selected models while filtering', () => {
    const onDeleteModel = vi.fn();
    const alpha = buildModel('model-alpha', 'alpha');
    const beta = buildModel('model-beta', 'beta');

    render(
      <ProviderModelsPanel
        {...buildProps({
          modelQuery: 'b',
          providerModels: [alpha, beta],
          filteredProviderModels: [beta],
          filteredFetchedModels: ['beta'],
          providerModelIdSet: new Set(['alpha', 'beta']),
          onDeleteModel,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove visible' }));

    expect(onDeleteModel).toHaveBeenCalledWith('model-beta');
    expect(onDeleteModel).toHaveBeenCalledTimes(1);
  });
});
