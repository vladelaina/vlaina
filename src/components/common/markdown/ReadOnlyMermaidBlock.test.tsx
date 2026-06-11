import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mermaidRenderer', () => ({
  generateMermaidId: () => 'mermaid-readonly-test',
  mermaidRenderErrorMarkup: () => '<div class="mermaid-error">Mermaid Error</div>',
  renderMermaid: vi.fn(),
}));

import {
  clearReadOnlyMermaidRenderCaches,
  getPendingReadOnlyMermaidRenderCount,
  MAX_PENDING_READONLY_MERMAID_RENDERS,
  ReadOnlyMermaidBlock,
  resolveReadOnlyMermaidMarkup,
} from './ReadOnlyMermaidBlock';
import { renderMermaid } from './mermaidRenderer';

describe('ReadOnlyMermaidBlock', () => {
  beforeEach(() => {
    clearReadOnlyMermaidRenderCaches();
    vi.mocked(renderMermaid).mockReset();
  });

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

  it('coalesces duplicate read-only Mermaid renders', async () => {
    let resolveRender: (markup: string) => void = () => undefined;
    vi.mocked(renderMermaid).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRender = resolve;
      })
    );

    const first = resolveReadOnlyMermaidMarkup('sequenceDiagram\nAlice->Bob: hi');
    const second = resolveReadOnlyMermaidMarkup('sequenceDiagram\nAlice->Bob: hi');

    expect(renderMermaid).toHaveBeenCalledTimes(1);
    expect(getPendingReadOnlyMermaidRenderCount()).toBe(1);

    resolveRender('<svg><text>rendered</text></svg>');

    await expect(first).resolves.toContain('rendered');
    await expect(second).resolves.toContain('rendered');
    expect(getPendingReadOnlyMermaidRenderCount()).toBe(0);
  });

  it('bounds pending read-only Mermaid renders for different diagrams', async () => {
    const renderResolves: Array<(markup: string) => void> = [];
    vi.mocked(renderMermaid).mockImplementation(
      () => new Promise((resolve) => {
        renderResolves.push(resolve);
      })
    );

    const renders = Array.from({ length: MAX_PENDING_READONLY_MERMAID_RENDERS }, (_value, index) =>
      resolveReadOnlyMermaidMarkup(`sequenceDiagram\nAlice->Bob: ${index}`)
    );
    renders.forEach((renderPromise) => {
      renderPromise.catch(() => undefined);
    });

    expect(getPendingReadOnlyMermaidRenderCount()).toBe(MAX_PENDING_READONLY_MERMAID_RENDERS);
    const overflowMarkup = await resolveReadOnlyMermaidMarkup('sequenceDiagram\nAlice->Bob: overflow');

    expect(overflowMarkup).toContain('mermaid-error');
    expect(getPendingReadOnlyMermaidRenderCount()).toBe(MAX_PENDING_READONLY_MERMAID_RENDERS);

    renderResolves.forEach((resolve, index) => {
      resolve(`<svg><text>rendered ${index}</text></svg>`);
    });
    await Promise.all(renders);
  });
});
