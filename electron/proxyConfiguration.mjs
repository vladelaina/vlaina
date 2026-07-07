import net from 'node:net';

function getConfiguredProxyConfig(normalizeProxyConfig) {
  const rawProxy = process.env.LOCAL_PROXY_URL
    ?? process.env.HTTPS_PROXY
    ?? process.env.HTTP_PROXY
    ?? process.env.ALL_PROXY
    ?? process.env.https_proxy
    ?? process.env.http_proxy
    ?? process.env.all_proxy
    ?? '';
  const source = process.env.LOCAL_PROXY_URL ? 'LOCAL_PROXY_URL' : 'standard-proxy-env';
  return normalizeProxyConfig(rawProxy, source);
}

function canConnectToLocalProxy(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
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

async function resolveProxyConfig(normalizeProxyConfig) {
  const configured = getConfiguredProxyConfig(normalizeProxyConfig);
  if (configured) return configured;
  if (await canConnectToLocalProxy(10808)) {
    return normalizeProxyConfig('http://127.0.0.1:10808', 'auto-detected-local-10808');
  }
  return null;
}

export function createProxyConfiguration({
  app,
  normalizeProxyConfig,
  session,
}) {
  const configuredProxyConfig = getConfiguredProxyConfig(normalizeProxyConfig);
  if (configuredProxyConfig) {
    app.commandLine.appendSwitch('proxy-server', configuredProxyConfig.proxyRules);
    app.commandLine.appendSwitch('proxy-bypass-list', '127.0.0.1;localhost;<local>');
  }

  async function configureProxySafely() {
    try {
      const proxyConfig = await resolveProxyConfig(normalizeProxyConfig);
      if (!proxyConfig) return;

      await session.defaultSession.setProxy({
        proxyRules: proxyConfig.proxyRules,
        proxyBypassRules: '127.0.0.1;localhost;<local>',
      });
    } catch (error) {
    }
  }

  return {
    configureProxySafely,
    configuredProxyConfig,
  };
}
