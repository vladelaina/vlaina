import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeProxyConfig } from '../../electron/externalUrlPolicy.mjs';
import {
  createProxyConfiguration,
  resolveProxyConfig,
} from '../../electron/proxyConfiguration.mjs';

const proxyEnvironmentKeys = [
  'LOCAL_PROXY_URL',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'ALL_PROXY',
  'https_proxy',
  'http_proxy',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
] as const;

function clearProxyEnvironment() {
  for (const key of proxyEnvironmentKeys) {
    vi.stubEnv(key, '');
  }
}

describe('Electron proxy configuration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('ignores an inherited loopback proxy when its port is unavailable', async () => {
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'http://127.0.0.1:45678');
    const canConnectToProxy = vi.fn().mockResolvedValue(false);

    await expect(resolveProxyConfig(normalizeProxyConfig, canConnectToProxy)).resolves.toBeNull();

    expect(canConnectToProxy).toHaveBeenCalledOnce();
    expect(canConnectToProxy).toHaveBeenCalledWith('127.0.0.1', 45678);
  });

  it('applies an inherited loopback proxy when its port is reachable', async () => {
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'http://127.0.0.1:7890');
    const canConnectToProxy = vi.fn().mockResolvedValue(true);
    const setProxy = vi.fn().mockResolvedValue(undefined);
    const configuration = createProxyConfiguration({
      canConnectToProxy,
      normalizeProxyConfig,
      session: { defaultSession: { setProxy } },
    });

    await configuration.configureProxySafely();

    expect(setProxy).toHaveBeenCalledWith({
      proxyRules: 'http=127.0.0.1:7890;https=127.0.0.1:7890',
      proxyBypassRules: '127.0.0.1;localhost;[::1];<local>',
    });
  });

  it('supports explicitly configured IPv6 loopback proxies', async () => {
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'http://[::1]:38421');
    const canConnectToProxy = vi.fn().mockResolvedValue(true);

    await expect(resolveProxyConfig(normalizeProxyConfig, canConnectToProxy)).resolves.toMatchObject({
      proxyRules: 'http=[::1]:38421;https=[::1]:38421',
    });

    expect(canConnectToProxy).toHaveBeenCalledWith('::1', 38421);
  });

  it('keeps configured remote proxies without probing them as local services', async () => {
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'https://proxy.example.test:8443');
    const canConnectToProxy = vi.fn();

    await expect(resolveProxyConfig(normalizeProxyConfig, canConnectToProxy)).resolves.toMatchObject({
      proxyRules: 'http=proxy.example.test:8443;https=proxy.example.test:8443',
    });

    expect(canConnectToProxy).not.toHaveBeenCalled();
  });

  it('preserves the Electron system and PAC proxy mode when no explicit proxy is available', async () => {
    clearProxyEnvironment();
    const canConnectToProxy = vi.fn();
    const setProxy = vi.fn();
    const configuration = createProxyConfiguration({
      canConnectToProxy,
      normalizeProxyConfig,
      session: { defaultSession: { setProxy } },
    });

    await configuration.configureProxySafely();

    expect(canConnectToProxy).not.toHaveBeenCalled();
    expect(setProxy).not.toHaveBeenCalled();
  });

  it('honors standard no-proxy rules without dropping local bypasses', async () => {
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'https://proxy.example.test:8443');
    vi.stubEnv('NO_PROXY', '.example.test,10.0.0.0/8');
    const setProxy = vi.fn().mockResolvedValue(undefined);
    const configuration = createProxyConfiguration({
      canConnectToProxy: vi.fn(),
      normalizeProxyConfig,
      session: { defaultSession: { setProxy } },
    });

    await configuration.configureProxySafely();

    expect(setProxy).toHaveBeenCalledWith({
      proxyRules: 'http=proxy.example.test:8443;https=proxy.example.test:8443',
      proxyBypassRules: '127.0.0.1;localhost;[::1];<local>;.example.test;10.0.0.0/8',
    });
  });

  it('does not block application startup when Electron proxy application stalls', async () => {
    vi.useFakeTimers();
    clearProxyEnvironment();
    vi.stubEnv('HTTPS_PROXY', 'https://proxy.example.test:8443');
    const setProxy = vi.fn(() => new Promise<void>(() => {}));
    const configuration = createProxyConfiguration({
      canConnectToProxy: vi.fn(),
      normalizeProxyConfig,
      session: { defaultSession: { setProxy } },
    });
    let settled = false;

    void configuration.configureProxySafely().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toBe(true);
  });
});
