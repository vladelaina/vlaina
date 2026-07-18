import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';

const mocks = vi.hoisted(() => ({
  storage: {
    platform: 'electron' as const,
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: async (...parts: string[]) => parts.join('/'),
}));

vi.mock('./basePath', () => ({
  getStorageBasePath: vi.fn().mockResolvedValue('/private/appdata'),
}));

import { performSplitSave } from './unifiedStorageSave';

describe('unified storage save diagnostics', () => {
  beforeEach(() => {
    clearDiagnosticsLog();
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.readFile.mockResolvedValue('{}');
    mocks.storage.writeFile.mockReset();
  });

  it('records the exact failing stage without exposing the storage path', async () => {
    mocks.storage.writeFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(
        new Error('Permission denied: /private/appdata/.vlaina/app/settings.backup.json'),
        { code: 'EACCES' },
      ));

    await expect(performSplitSave({
      data: {
        settings: {
          timezone: { offset: 480, city: 'Private City' },
          markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
        },
        customIcons: [],
      },
      patch: { settings: { markdown: { typewriterMode: true } } },
      persistAI: false,
      persistProviders: false,
    })).rejects.toThrow('Permission denied');

    const report = JSON.parse(getDiagnosticsLogText());
    const failure = report.entries.find(
      (entry: { channel: string; event: string }) =>
        entry.channel === 'unified-storage' && entry.event === 'stage-failed',
    );

    expect(failure.details).toEqual(expect.objectContaining({
      stage: 'write-main-backup',
      platform: 'electron',
      writeMode: 'patch',
      patchSections: ['settings.markdown'],
      errorCode: 'EACCES',
      errorMessage: 'Permission denied: <path>',
    }));
    expect(JSON.stringify(failure)).not.toContain('/private/appdata');
    expect(JSON.stringify(failure)).not.toContain('Private City');
  });
});
