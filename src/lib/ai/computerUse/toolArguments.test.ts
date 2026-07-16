import { describe, expect, it } from 'vitest';
import { parseComputerCommandArguments } from './toolArguments';

describe('computer command tool arguments', () => {
  it('accepts a bounded command with a factual purpose', () => {
    expect(parseComputerCommandArguments(JSON.stringify({
      command: 'printf ok',
      purpose: 'Print a test value',
      cwd: '/tmp/project',
      timeout_seconds: 30,
    }))).toEqual({
      command: 'printf ok',
      purpose: 'Print a test value',
      cwd: '/tmp/project',
      timeoutSeconds: 30,
    });
  });

  it('rejects commands without an explanation or with a relative directory', () => {
    expect(parseComputerCommandArguments(JSON.stringify({ command: 'printf ok' }))).toBeNull();
    expect(parseComputerCommandArguments(JSON.stringify({
      command: 'printf ok',
      purpose: 'Print a test value',
      cwd: '../project',
    }))).toBeNull();
  });

  it('rejects invisible formatting characters before native approval', () => {
    expect(parseComputerCommandArguments(JSON.stringify({
      command: 'printf safe\u200Bhidden',
      purpose: 'Print a test value',
    }))).toBeNull();
  });

  it('rejects commands too long to review safely in native approval', () => {
    expect(parseComputerCommandArguments(JSON.stringify({
      command: 'x'.repeat(2049),
      purpose: 'Run an oversized command',
    }))).toBeNull();
  });
});
