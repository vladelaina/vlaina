import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelHealthCheckWidget } from './ModelHealthCheckWidget';

const { start, stop, subscribe } = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: () => true,
}));

vi.mock('@/lib/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/lib/ai/modelBenchmark/backgroundRunner', () => ({
  backgroundBenchmarkRunner: { start, stop, subscribe },
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: (selector: (state: unknown) => unknown) => selector({
    data: {
      ai: {
        providers: [{ id: 'provider-1', name: 'Provider', enabled: true }],
        models: [{ id: 'model-1', name: 'Model 1', apiModelId: 'model-1', providerId: 'provider-1', enabled: true }],
      },
    },
  }),
}));

describe('ModelHealthCheckWidget', () => {
  beforeEach(() => {
    start.mockReset();
    stop.mockReset();
    subscribe.mockClear();
  });

  it('renders the benchmark action without adding another collapse control', () => {
    render(<ModelHealthCheckWidget />);

    expect(screen.getByRole('button', { name: 'settings.ai.benchmarkAll' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /model health check/i })).not.toBeInTheDocument();
  });
});
