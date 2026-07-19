import { describe, expect, it } from 'vitest';
import {
  getWindowsAppUserModelId,
  isMicrosoftStoreRuntime,
} from '../../electron/microsoftStoreIdentity.mjs';

describe('Microsoft Store runtime identity', () => {
  it('uses the package AUMID for Store builds', () => {
    const runtime = { windowsStore: true };
    expect(isMicrosoftStoreRuntime(runtime)).toBe(true);
    expect(getWindowsAppUserModelId(runtime)).toBe('vladelaina.vlaina_hnew8t3b8e0t6!vlaina');
  });

  it('keeps the direct distribution AUMID for ordinary builds', () => {
    expect(isMicrosoftStoreRuntime({})).toBe(false);
    expect(getWindowsAppUserModelId({})).toBe('com.vlaina.desktop');
  });
});
