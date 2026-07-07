import net from 'node:net';

export const DEFAULT_PORT = 3000;
export const MAX_PORT = 3100;
export const DEFAULT_PORT_REUSE_GRACE_MS = 2_500;
export const DEFAULT_PORT_REUSE_RETRY_INTERVAL_MS = 100;

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

export async function chooseAvailablePort(startPort, options = {}) {
  const {
    checkPortAvailable: checkPortAvailableFn = checkPortAvailable,
    delay: delayFn = delay,
    isShutdownRequested = () => false,
    isPortUsable = () => true,
    log: logFn = () => {},
    maxPort = MAX_PORT,
    reuseGraceMs = DEFAULT_PORT_REUSE_GRACE_MS,
    retryIntervalMs = DEFAULT_PORT_REUSE_RETRY_INTERVAL_MS,
  } = options;

  const isStartPortAvailable = await checkPortAvailableFn(startPort);
  if (isStartPortAvailable) {
    if (isPortUsable(startPort)) {
      return startPort;
    }
  } else {
    logFn(
      '33',
      `Renderer port ${startPort} is already in use; waiting up to ${reuseGraceMs}ms for it to be released.`
    );
  }

  let waitedMs = 0;
  while (!isStartPortAvailable && waitedMs < reuseGraceMs) {
    if (isShutdownRequested()) {
      throw new Error('Dev startup interrupted');
    }

    const waitMs = Math.min(retryIntervalMs, reuseGraceMs - waitedMs);
    await delayFn(waitMs);
    waitedMs += waitMs;

    if (await checkPortAvailableFn(startPort) && isPortUsable(startPort)) {
      logFn('32', `Renderer port ${startPort} was released; reusing it`);
      return startPort;
    }
  }

  if (!isStartPortAvailable) {
    logFn(
      '33',
      `Renderer port ${startPort} stayed in use; opening a parallel dev server will split dev localStorage. Stop the old dev server if startup view looks stale.`
    );
  }

  for (let port = startPort + 1; port < maxPort; port += 1) {
    if (await checkPortAvailableFn(port) && isPortUsable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports found between ${startPort} and ${maxPort - 1}`);
}

export function waitForPortOpen(port, timeoutMs, options = {}) {
  const {
    connect = net.createConnection,
    isShutdownRequested = () => false,
  } = options;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (isShutdownRequested()) {
        reject(new Error('Dev startup interrupted'));
        return;
      }

      const socket = connect({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for renderer on port ${port}`));
          return;
        }

        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}
