import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComputerCommandPhase, ComputerCommandStatus } from '@/lib/ai/computerUse/types';
import { ComputerCommandStatusBlock } from './ComputerCommandStatusBlock';

function status(id: string, phase: ComputerCommandPhase): ComputerCommandStatus {
  return {
    id,
    phase,
    command: `printf ${id}`,
    cwd: '/tmp/project',
    purpose: `Run ${id}`,
    stdout: '',
    stderr: '',
    updatedAt: 0,
  };
}

describe('ComputerCommandStatusBlock', () => {
  it('collapses as one stable group and shows completed only once', () => {
    const initial = [
      status('one', 'completed'),
      status('two', 'completed'),
      status('three', 'failed'),
    ];
    const view = render(<ComputerCommandStatusBlock statuses={initial} />);
    const toggle = screen.getByRole('button', { name: 'Computer control' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('printf one')).toBeInTheDocument();
    expect(screen.getByText('printf two')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('printf one')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();

    view.rerender(
      <ComputerCommandStatusBlock statuses={[...initial, status('four', 'running')]} />,
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('printf four')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('printf four')).toBeInTheDocument();
  });
});
