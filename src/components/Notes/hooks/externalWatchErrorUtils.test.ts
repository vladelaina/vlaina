import { describe, expect, it } from 'vitest';
import {
  getExternalWatchErrorMessage,
  isExternalWatchUnavailableError,
} from './externalWatchErrorUtils';

describe('externalWatchErrorUtils', () => {
  it('extracts readable messages from unknown errors', () => {
    expect(getExternalWatchErrorMessage('plain')).toBe('plain');
    expect(getExternalWatchErrorMessage(new Error('boom'))).toBe('boom');
    expect(getExternalWatchErrorMessage({ message: 'object-message' })).toBe('object-message');
  });

  it('treats unsupported watch commands as unavailable watchers', () => {
    expect(isExternalWatchUnavailableError('Electron fs bridge is not available.')).toBe(true);
    expect(isExternalWatchUnavailableError('ENOSPC: System limit for number of file watchers reached')).toBe(true);
    expect(isExternalWatchUnavailableError('fs.watch not allowed')).toBe(true);
    expect(isExternalWatchUnavailableError('watch not allowed')).toBe(true);
    expect(isExternalWatchUnavailableError('ENOSPC: System limit for number of file watchers reached')).toBe(true);
    expect(isExternalWatchUnavailableError('Command watch not found')).toBe(true);
    expect(isExternalWatchUnavailableError('Command not found: watch')).toBe(true);
    expect(isExternalWatchUnavailableError('ENOSPC: System limit for number of file watchers reached')).toBe(true);
    expect(isExternalWatchUnavailableError('some other failure')).toBe(false);
  });
});
