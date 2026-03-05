import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodoPanel } from './TodoPanel';

const mockUseGroupStore = vi.fn();
const mockSetActiveGroup = vi.fn();

vi.mock('@/stores/useGroupStore', () => ({
  useGroupStore: () => mockUseGroupStore(),
}));

vi.mock('./views', () => ({
  TasksView: () => <div data-testid="tasks-view">TasksView</div>,
  InboxView: () => <div data-testid="inbox-view">InboxView</div>,
  ProgressView: () => <div data-testid="progress-view">ProgressView</div>,
  CompletedView: () => <div data-testid="completed-view">CompletedView</div>,
}));

describe('TodoPanel', () => {
  beforeEach(() => {
    mockUseGroupStore.mockReset();
    mockSetActiveGroup.mockReset();
  });

  it('renders ProgressView when activeGroupId is progress', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'progress', setActiveGroup: mockSetActiveGroup });
    render(<TodoPanel />);
    expect(screen.getByTestId('progress-view')).toBeInTheDocument();
  });

  it('redirects legacy today group to all', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'today', setActiveGroup: mockSetActiveGroup });
    render(<TodoPanel />);
    expect(screen.getByTestId('inbox-view')).toBeInTheDocument();
    expect(mockSetActiveGroup).toHaveBeenCalledWith('all');
  });

  it('renders CompletedView when activeGroupId is completed', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'completed', setActiveGroup: mockSetActiveGroup });
    render(<TodoPanel />);
    expect(screen.getByTestId('completed-view')).toBeInTheDocument();
  });

  it('renders TasksView when activeGroupId is all', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'all', setActiveGroup: mockSetActiveGroup });
    render(<TodoPanel />);
    expect(screen.getByTestId('tasks-view')).toBeInTheDocument();
  });

  it('falls back to InboxView for unknown activeGroupId', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'unknown', setActiveGroup: mockSetActiveGroup });
    render(<TodoPanel />);
    expect(screen.getByTestId('inbox-view')).toBeInTheDocument();
  });
});
