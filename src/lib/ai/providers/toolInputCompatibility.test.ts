import { describe, expect, it } from 'vitest';
import { isToolInputUnsupported } from './toolInputCompatibility';

describe('isToolInputUnsupported', () => {
  it.each([
    'Error invoking remote method desktop:managed:chat-completion: Error: UNSUPPORTED_MODEL_INPUT',
    'Error invoking remote method desktop:managed:chat-completion: Error: unsupported_message_content',
  ])('recognizes managed public error codes wrapped by Electron IPC', (message) => {
    expect(isToolInputUnsupported(new Error(message))).toBe(true);
  });

  it('does not treat an unrelated wrapped validation error as tool incompatibility', () => {
    expect(isToolInputUnsupported(new Error(
      'Error invoking remote method desktop:managed:chat-completion: Error: INVALID_REQUEST',
    ))).toBe(false);
  });
});
