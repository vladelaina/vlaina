import { describe, expect, it } from 'vitest';
import {
  getUnifiedSaveRequestDiagnosticDetails,
} from './unifiedStorageDiagnostics';
import { getErrorDiagnosticDetails } from '@/lib/diagnostics/errorDetails';

describe('unified storage diagnostics', () => {
  it('reports patch categories without including saved values', () => {
    const details = getUnifiedSaveRequestDiagnosticDetails({
      data: {
        settings: {
          timezone: { offset: 480, city: 'Private City' },
          markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
        },
        customIcons: [],
      },
      patch: {
        settings: {
          timezone: { offset: 480, city: 'Private City' },
          markdown: { typewriterMode: true },
        },
        ai: { sessions: true },
      },
      persistAI: true,
      persistProviders: false,
    });

    expect(details).toEqual({
      writeMode: 'patch',
      patchSections: ['settings.timezone', 'settings.markdown', 'ai.sessions'],
      persistAI: true,
      persistProviders: false,
    });
    expect(JSON.stringify(details)).not.toContain('Private City');
  });

  it('keeps useful error metadata while removing paths and secret-like values', () => {
    const error = Object.assign(
      new Error('Failed to write /home/example/.vlaina/app/settings.json with sk-private_token_123456'),
      { code: 'EACCES' },
    );

    expect(getErrorDiagnosticDetails(error)).toEqual({
      errorName: 'Error',
      errorMessage: 'Failed to write <path> with <secret>',
      errorCode: 'EACCES',
    });
  });

  it('includes a safe note conflict reason when available', () => {
    const error = Object.assign(new Error('Conflict'), {
      name: 'NoteWriteConflictError',
      conflictReason: 'conditional-write-rejected',
    });

    expect(getErrorDiagnosticDetails(error)).toEqual({
      errorName: 'NoteWriteConflictError',
      errorMessage: 'Conflict',
      conflictReason: 'conditional-write-rejected',
    });
  });
});
