import type { ChangeEvent, KeyboardEventHandler, ReactNode, Ref, UIEventHandler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchSidebarOpenSearchEvent } from '@/components/layout/sidebar/sidebarEvents';
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
  SidebarScrollArea: ({
    children,
    onScroll,
    ref,
  }: {
    children: ReactNode;
    onScroll?: UIEventHandler<HTMLDivElement>;
    ref?: Ref<HTMLDivElement>;
  }) => <div ref={ref} data-testid="graph-scroll-root" onScroll={onScroll}>{children}</div>,
  SidebarSurface: ({
    children,
    ref,
  }: {
    children: ReactNode;
    ref?: Ref<HTMLDivElement>;
  }) => <div ref={ref}>{children}</div>,
  SidebarSearchField: ({
    'aria-label': ariaLabel,
    closeLabel,
    onChange,
    onClose,
    onKeyDown,
    placeholder,
    ref,
    value,
  }: {
    'aria-label': string;
    closeLabel: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onClose: () => void;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
    placeholder?: string;
    ref?: Ref<HTMLInputElement>;
    value: string;
  }) => (
    <div>
      <input
        ref={ref}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
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
    expect(screen.queryByRole('button', { name: 'PlanPlan.md' })).not.toBeInTheDocument();

    fireEvent.wheel(screen.getByTestId('graph-scroll-root'), { deltaY: -60 });

    const searchInput = screen.getByRole('textbox', { name: 'graph.searchPlaceholder' });
    const modeSelector = screen.getByRole('group', { name: 'app.viewGraph' });
    expect(searchInput.compareDocumentPosition(modeSelector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    act(() => dispatchSidebarOpenSearchEvent('graph'));
    expect(searchInput.closest('.grid')).toHaveClass('grid-rows-[1fr]');
  });
});
