import { describe, expect, it } from 'vitest';
import { getInvalidFileNameReason, isValidFileName, sanitizeFileName } from './noteUtils';

describe('noteUtils file names', () => {
  it('keeps the legacy sanitizer behavior for fallback file names', () => {
    expect(sanitizeFileName(' a:b?.md ')).toBe('ab.md');
    expect(sanitizeFileName('...')).toBe('Untitled');
  });

  it('rejects unsupported file name input instead of silently accepting it', () => {
    expect(isValidFileName('Project Notes')).toBe(true);
    expect(getInvalidFileNameReason('Project/Notes')).toBe('File name contains unsupported characters.');
    expect(getInvalidFileNameReason('Project:Notes')).toBe('File name contains unsupported characters.');
    expect(getInvalidFileNameReason('Project\nNotes')).toBe('File name contains unsupported characters.');
    expect(getInvalidFileNameReason('...')).toBe('File name cannot contain only dots.');
    expect(getInvalidFileNameReason('.hidden')).toBe('File name cannot start or end with a dot.');
    expect(getInvalidFileNameReason('trailing.')).toBe('File name cannot start or end with a dot.');
  });
});
