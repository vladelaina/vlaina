import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GraphTopControls } from './GraphTopControls';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, number>) => (
      values ? `${key}:${values.count}` : key
    ),
  }),
}));

describe('GraphTopControls', () => {
  it('shows graph counts without duplicating the sidebar search', () => {
    render(<GraphTopControls nodeCount={240} linkCount={1920} />);

    expect(screen.getByText('graph.nodesCount:240')).toBeInTheDocument();
    expect(screen.getByText('graph.linksCount:1920')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
