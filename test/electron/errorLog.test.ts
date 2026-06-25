import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createErrorLogService } from '../../electron/errorLog.mjs';

let tempDirs: string[] = [];

function createMockApp() {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vlaina-error-log-'));
  tempDirs.push(userDataPath);

  return {
    isPackaged: true,
    getName: () => 'vlaina-test',
    getVersion: () => '9.9.9',
    getLocale: () => 'zh-CN',
    getPath: (name: string) => {
      if (name !== 'userData') {
        throw new Error(`Unexpected path request: ${name}`);
      }
      return userDataPath;
    },
  };
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
  tempDirs = [];
});

describe('error log service', () => {
  it('persists renderer diagnostics without query parameter values', () => {
    const service = createErrorLogService({ app: createMockApp() });
    const logFilePath = service.logRendererError({
      source: 'react-error-boundary',
      type: 'react',
      name: 'TypeError',
      message: 'Cannot read properties of null',
      reactVersion: '19.2.7',
      buildMode: 'production',
      isDev: false,
      isProd: true,
      location: {
        protocol: 'file:',
        origin: 'file://',
        pathname: '/C:/Program Files/vlaina/resources/app.asar/dist/index.html',
        hash: '',
        search: '?notePath=C:/Users/example/private-note.md',
        searchKeys: ['vaultPath', 'notePath'],
      },
      document: {
        title: 'vlaina',
        visibilityState: 'visible',
        hasFocus: true,
      },
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24,
      },
      timezone: {
        timeZone: 'Asia/Shanghai',
        offsetMinutes: -480,
      },
      storage: {
        localStorage: true,
        sessionStorage: true,
        indexedDB: true,
      },
      runtime: {
        isSecureContext: true,
        crossOriginIsolated: false,
        hardwareConcurrency: 16,
        deviceMemory: 8,
        maxTouchPoints: 0,
      },
    }, 'renderer-reported-error');

    expect(logFilePath).toBeTruthy();
    const entry = JSON.parse(fs.readFileSync(logFilePath!, 'utf8'));

    expect(entry.schemaVersion).toBe(2);
    expect(entry.processType).toBe('renderer');
    expect(entry.renderer.diagnostics).toMatchObject({
      reactVersion: '19.2.7',
      buildMode: 'production',
      isDev: false,
      isProd: true,
      location: {
        searchKeys: ['vaultPath', 'notePath'],
      },
      document: {
        title: 'vlaina',
        visibilityState: 'visible',
        hasFocus: true,
      },
      timezone: {
        timeZone: 'Asia/Shanghai',
        offsetMinutes: -480,
      },
      storage: {
        localStorage: true,
        sessionStorage: true,
        indexedDB: true,
      },
    });
    expect(JSON.stringify(entry)).not.toContain('C:/Users/example/private-note.md');
  });
});
