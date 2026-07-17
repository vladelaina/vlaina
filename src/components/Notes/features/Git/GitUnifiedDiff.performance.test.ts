import { describe, expect, it } from 'vitest';
import { groupGitDiffLineRuns } from './GitUnifiedDiff';

describe('GitUnifiedDiff rendering budget', () => {
  it('renders a large contiguous addition as one DOM run', () => {
    const lines = Array.from({ length: 10_000 }, (_, index) => `+Added line ${index}`);

    const runs = groupGitDiffLineRuns(lines);

    expect(runs).toHaveLength(1);
    expect(runs[0].text).toContain('+Added line 0');
    expect(runs[0].text).toContain('+Added line 9999');
  });

  it('keeps different diff line types in separate color runs', () => {
    const runs = groupGitDiffLineRuns([' context', '-old', '-older', '+new', '+newer', ' context']);

    expect(runs).toHaveLength(4);
  });
});
