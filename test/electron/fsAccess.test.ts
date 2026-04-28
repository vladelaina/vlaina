import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProtectedAppDataPath } from '../../electron/fsAccess.mjs';

describe('desktop filesystem access boundary', () => {
  const userDataPath = path.join('/home/alice', '.config', 'vlaina');

  it('protects internal secret directories and sensitive account store files from generic renderer fs access', () => {
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'secrets'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'secrets', 'ai-provider-secrets.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'store', 'account-secrets.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'store', 'account-meta.json'), userDataPath)).toBe(true);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'store', 'authorized-fs-paths.json'), userDataPath)).toBe(true);
  });

  it('keeps normal app data files accessible through the generic storage adapter', () => {
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'store'), userDataPath)).toBe(false);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'data.json'), userDataPath)).toBe(false);
    expect(isProtectedAppDataPath(path.join(userDataPath, '.vlaina', 'chat', 'sessions.json'), userDataPath)).toBe(false);
  });
});
