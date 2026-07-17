import type { ChangeEvent, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphSidebar } from './GraphSidebar';

const graphStore = vi.hoisted(() => ({
  mode: 'local' as 'all' | 'local',
  searchQuery: 'plan',
  selectedPath: 'Plan.md' as string | null,
  setMode: vi.fn(),
  setSearchQuery: vi.fn(),
  setSelectedPath: vi.fn(),
}));

const notesStore = vi.hoisted(() => ({
  currentNote: { path: 'Plan.md', content: '' },
  noteContentsCache: new Map([
    ['Plan.md', { content: '[[Product Plan]]', modifiedAt: 1 }],
    ['Product Plan.md', { content: '[[Planning]]', modifiedAt: 1 }],
    ['docs/Planning.md', { content: '', modifiedAt: 1 }],
  ]),
  noteContentsCacheRevision: 1,
  rootFolder: {
    id: '',
    name: 'Notes',
    path: '',
    isFolder: true,
    expanded: true,
    children: [
      { id: 'Plan.md', name: 'Plan.md', path: 'Plan.md', isFolder: false },
      { id: 'Product Plan.md', name: 'Product Plan.md', path: 'Product Plan.md', isFolder: false },
      { id: 'docs/Planning.md', name: 'Planning.md', path: 'docs/Planning.md', isFolder: false },
    ],
  },
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => (
      values ? `${key}:${values.count}` : key
    ),
  }),
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesStore) => unknown) => selector(notesStore),
}));

vi.mock('./store/useGraphUIStore', () => ({
  useGraphUIStore: (selector: (state: typeof graphStore) => unknown) => selector(graphStore),
}));

vi.mock('@/components/layout/sidebar/AppViewModeSwitch', () => ({
  AppViewModeSwitch: () => <div />,
}));

vi.mock('@/components/layout/sidebar/SidebarPrimitives', () => ({
  SidebarActionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarCapsulePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarSearchField: ({
    'aria-label': ariaLabel,
    closeLabel,
    onChange,
    onClose,
    value,
  }: {
    'aria-label': string;
    closeLabel: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onClose: () => void;
    value: string;
  }) => (
    <div>
      <input aria-label={ariaLabel} value={value} onChange={onChange} />
      <button type="button" onClick={onClose}>{closeLabel}</button>
    </div>
  ),
}));

describe('GraphSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows ranked search results wired to graph controls', () => {
    render(<GraphSidebar />);

    expect(screen.queryByText('app.viewGraph')).not.toBeInTheDocument();
    expect(screen.getByText('graph.modeLocal')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-graph-mode-indicator="true"]')).toHaveClass('translate-x-full');
    const exactResult = screen.getByRole('button', { name: 'PlanPlan.md' });
    const prefixResult = screen.getByRole('button', { name: 'Planningdocs/Planning.md' });
    const wordResult = screen.getByRole('button', { name: 'Product PlanProduct Plan.md' });
    expect(exactResult.compareDocumentPosition(prefixResult) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(prefixResult.compareDocumentPosition(wordResult) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'graph.modeAll' }));
    expect(graphStore.setMode).toHaveBeenCalledWith('all');

    fireEvent.change(screen.getByRole('textbox', { name: 'graph.searchPlaceholder' }), {
      target: { value: 'product' },
    });
    expect(graphStore.setSearchQuery).toHaveBeenCalledWith('product');

    fireEvent.click(prefixResult);
    expect(graphStore.setSelectedPath).toHaveBeenCalledWith('docs/Planning.md');

    fireEvent.click(screen.getByRole('button', { name: 'graph.clearSearch' }));
    expect(graphStore.setSearchQuery).toHaveBeenCalledWith('');
  });
});
