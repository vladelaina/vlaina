import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodoPanel } from './TodoPanel';

const mockUseGroupStore = vi.fn();

vi.mock('@/stores/useGroupStore', () => ({
  useGroupStore: () => mockUseGroupStore(),
}));

vi.mock('./views', () => ({
  TasksView: () => <div data-testid="tasks-view">TasksView</div>,
  TodayView: () => <div data-testid="today-view">TodayView</div>,
  InboxView: () => <div data-testid="inbox-view">InboxView</div>,
  ProgressView: () => <div data-testid="progress-view">ProgressView</div>,
  CompletedView: () => <div data-testid="completed-view">CompletedView</div>,
}));

describe('TodoPanel', () => {
  beforeEach(() => {
    mockUseGroupStore.mockReset();
  });

  it('renders ProgressView when activeGroupId is progress', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'progress' });
    render(<TodoPanel />);
    expect(screen.getByTestId('progress-view')).toBeInTheDocument();
  });

  it('renders TodayView when activeGroupId is today', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'today' });
    render(<TodoPanel />);
    expect(screen.getByTestId('today-view')).toBeInTheDocument();
  });

  it('renders CompletedView when activeGroupId is completed', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'completed' });
    render(<TodoPanel />);
    expect(screen.getByTestId('completed-view')).toBeInTheDocument();
  });

  it('renders TasksView when activeGroupId is all', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'all' });
    render(<TodoPanel />);
    expect(screen.getByTestId('tasks-view')).toBeInTheDocument();
  });

  it('falls back to InboxView for unknown activeGroupId', () => {
    mockUseGroupStore.mockReturnValue({ activeGroupId: 'unknown' });
    render(<TodoPanel />);
    expect(screen.getByTestId('inbox-view')).toBeInTheDocument();
  });
});
