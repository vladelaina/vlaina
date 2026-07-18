import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';

const mocks = vi.hoisted(() => ({
  performSplitSave: vi.fn(),
  showStorageToast: vi.fn(),
}));

vi.mock('./unifiedStorageSave', () => ({
  performSplitSave: mocks.performSplitSave,
}));

vi.mock('./unifiedStorageNotifications', () => ({
  showStorageToast: mocks.showStorageToast,
}));

import { cancelPendingSave, saveUnifiedDataImmediate } from './unifiedStorageQueue';

const data = {
  settings: {
    timezone: { offset: 480, city: 'Private City' },
    markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
  },
  customIcons: [],
};

describe('unified storage queue diagnostics', () => {
  beforeEach(() => {
    cancelPendingSave();
    clearDiagnosticsLog();
    mocks.performSplitSave.mockReset();
    mocks.showStorageToast.mockReset();
  });

  it('records failures, retries, and recovery without saved data', async () => {
    mocks.performSplitSave.mockRejectedValueOnce(
      new Error('Disk unavailable at C:\\Users\\Example\\settings.json with token-private_123456'),
    );

    await expect(saveUnifiedDataImmediate(data)).rejects.toThrow('Disk unavailable');
    cancelPendingSave();

    mocks.performSplitSave.mockResolvedValueOnce(undefined);
    await expect(saveUnifiedDataImmediate(data)).resolves.toBeUndefined();

    const report = JSON.parse(getDiagnosticsLogText());
    const failed = report.entries.find(
      (entry: { channel: string; event: string }) =>
        entry.channel === 'unified-storage' && entry.event === 'write-failed',
    );
    const recovered = report.entries.find(
      (entry: { channel: string; event: string; details?: { recoveredAfterFailures?: number } }) =>
        entry.channel === 'unified-storage'
        && entry.event === 'write-succeeded'
        && entry.details?.recoveredAfterFailures === 1,
    );

    expect(failed.details).toEqual(expect.objectContaining({
      consecutiveFailures: 1,
      willRetry: true,
      errorMessage: 'Disk unavailable at <path> with <secret>',
    }));
    expect(recovered).toBeDefined();
    expect(mocks.showStorageToast).toHaveBeenCalledWith('storage.saveFailed', 'error', 5000);
    expect(JSON.stringify(report.entries)).not.toContain('Private City');
    expect(JSON.stringify(report.entries)).not.toContain('Users\\\\Example');
  });
});
