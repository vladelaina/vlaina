import net from 'node:net';

const defaultProxyBypassRules = ['127.0.0.1', 'localhost', '[::1]', '<local>'];
const maxProxyBypassEnvironmentChars = 4096;
const proxyApplicationTimeoutMs = 2000;

function waitAtMost(promise, timeoutMs) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
}

function getProxyBypassRules() {
  const rawValue = process.env.NO_PROXY?.trim() || process.env.no_proxy?.trim() || '';
  if (!rawValue || rawValue.length > maxProxyBypassEnvironmentChars || /[\u0000-\u001f\u007f]/.test(rawValue)) {
    return defaultProxyBypassRules.join(';');
  }

  const configuredRules = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && value.length <= 512 && !/\s/.test(value));
  return [...new Set([...defaultProxyBypassRules, ...configuredRules])].join(';');
}

function getConfiguredProxyConfig(normalizeProxyConfig) {
  const localProxy = process.env.LOCAL_PROXY_URL?.trim() || '';
  const rawProxy = localProxy || [
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    process.env.ALL_PROXY,
    process.env.https_proxy,
    process.env.http_proxy,
    process.env.all_proxy,
  ].find((value) => value?.trim()) || '';
  const source = localProxy ? 'LOCAL_PROXY_URL' : 'standard-proxy-env';
  const config = normalizeProxyConfig(rawProxy, source);
  return config ? { ...config, proxyBypassRules: getProxyBypassRules() } : null;
}

function canConnectToLocalProxy(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (available) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function readLoopbackProxyAddress(proxyConfig) {
  try {
    const url = new URL(proxyConfig.proxyServer);
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' && url.hostname !== '[::1]') {
      return null;
    }
    const defaultPort = url.protocol.startsWith('socks') ? 1080 : url.protocol === 'https:' ? 443 : 80;
    const port = Number(url.port || defaultPort);
    return Number.isInteger(port) && port > 0 && port <= 65535
      ? { host: url.hostname === '[::1]' ? '::1' : url.hostname, port }
      : null;
  } catch {
    return null;
  }
}

export async function resolveProxyConfig(
  normalizeProxyConfig,
  canConnectToProxy = canConnectToLocalProxy,
) {
  const configured = getConfiguredProxyConfig(normalizeProxyConfig);
  if (configured) {
    const loopbackAddress = readLoopbackProxyAddress(configured);
    if (!loopbackAddress || await canConnectToProxy(loopbackAddress.host, loopbackAddress.port)) {
      return configured;
    }
  }
  return null;
}

export function createProxyConfiguration({
  canConnectToProxy,
  normalizeProxyConfig,
  session,
}) {
  const configuredProxyConfig = getConfiguredProxyConfig(normalizeProxyConfig);

  async function configureProxySafely() {
    try {
      const proxyConfig = await resolveProxyConfig(normalizeProxyConfig, canConnectToProxy);
      if (!proxyConfig) return;

      await waitAtMost(
        session.defaultSession.setProxy({
          proxyRules: proxyConfig.proxyRules,
          proxyBypassRules: proxyConfig.proxyBypassRules,
        }),
        proxyApplicationTimeoutMs,
      );
    } catch (error) {
    }
  }

  return {
    configureProxySafely,
    configuredProxyConfig,
  };
}
