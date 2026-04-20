import net from 'net';
import { spawn } from 'child_process';
import { assertNotWsl } from './ensure-not-wsl.mjs';

assertNotWsl('dev:dynamic');

// Start checking from default port
const DEFAULT_PORT = 3000;
const MAX_PORT = 3100;

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1');

    server.on('listening', () => {
      server.close();
      resolve(true);
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < MAX_PORT; port++) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${MAX_PORT}`);
}

async function startDev() {
  try {
    const port = await findAvailablePort(DEFAULT_PORT);
    console.log(`\x1b[32m[vlaina] Found available port: ${port}\x1b[0m`);

    // Set environment variable for Vite
    process.env.VITE_PORT = port.toString();

    // Construct the renderer dev URL dynamically
    const devUrl = `http://127.0.0.1:${port}`;

    console.log(`\x1b[36m[vlaina] Starting Electron dev with renderer URL: ${devUrl}\x1b[0m`);

    const child = spawn('pnpm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        VITE_PORT: port.toString(),
        VITE_DEV_SERVER_URL: devUrl,
      }
    });

    child.on('error', (err) => {
      console.error('Failed to start subprocess:', err);
    });

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });

  } catch (err) {
    console.error(`\x1b[31m[Error] ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

startDev();
