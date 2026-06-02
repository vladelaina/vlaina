import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./mermaidRenderer', () => ({
  generateMermaidId: () => 'mermaid-readonly-test',
  renderMermaid: vi.fn(),
}));

import { ReadOnlyMermaidBlock } from './ReadOnlyMermaidBlock';
import { renderMermaid } from './mermaidRenderer';

describe('ReadOnlyMermaidBlock', () => {
  it('does not expose diagram source in DOM attributes while loading or rendered', async () => {
    let resolveRender: (markup: string) => void = () => undefined;
    vi.mocked(renderMermaid).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRender = resolve;
      })
    );

    const code = 'sequenceDiagram\nAlice->Bob: secret token';
    const { container } = render(<ReadOnlyMermaidBlock code={code} />);

    expect(container.querySelector('.mermaid-placeholder')).not.toBeNull();
    expect(container.innerHTML).not.toContain('data-code');
    expect(container.innerHTML).not.toContain('secret token');

    resolveRender('<svg><text>rendered</text></svg>');

    await waitFor(() => {
      expect(screen.getByText('rendered')).toBeInTheDocument();
    });
    expect(container.innerHTML).not.toContain('data-code');
    expect(container.innerHTML).not.toContain('secret token');
  });
});
