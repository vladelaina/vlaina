import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProtectedAppDataPath } from '../../electron/fsAccess.mjs';

describe('desktop filesystem access boundary', () => {
  const userDataPath = path.join('/home/alice', '.config', 'vlaina');

  it('protects internal secret directories and sensitive account store files from generic renderer fs access', () => {
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'secrets'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'secrets', 'ai-providers.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'secrets', 'account.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'account', 'profile.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'permissions', 'filesystem.json'), userDataPath)).toBe(true);
  });

  it('keeps normal app data files accessible through the generic storage adapter', () => {
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app'), userDataPath)).toBe(false);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'app', 'settings.json'), userDataPath)).toBe(false);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'chat', 'sessions', 'index.json'), userDataPath)).toBe(false);
  });
});
