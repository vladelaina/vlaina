import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

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
    console.log(`\x1b[32m[NekoTick] Found available port: ${port}\x1b[0m`);

    // Set environment variable for Vite
    process.env.VITE_PORT = port.toString();

    // Construct the Tauri dev URL dynamically
    const devUrl = `http://127.0.0.1:${port}`;

    // Arguments for tauri dev
    const config = {
      build: {
        devUrl: devUrl
      }
    };

    // Serialize config to JSON
    const configJson = JSON.stringify(config);

    // Resolve Tauri CLI directly using Node's resolution algo
    // This is cross-platform and handles pnpm symlinks correctly
    let tauriScript;
    try {
      // Resolve package.json first to find the root
      const cliPkg = require.resolve('@tauri-apps/cli/package.json');
      const cliDir = path.dirname(cliPkg);
      // We know from package.json that bin is ./tauri.js
      tauriScript = path.join(cliDir, 'tauri.js');
    } catch (e) {
      // Fallback or error
      console.error('Could not resolve @tauri-apps/cli location:', e);
      process.exit(1);
    }

    console.log(`\x1b[36m[NekoTick] Starting Tauri with devUrl: ${devUrl}\x1b[0m`);

    // Execute via node directly
    const child = spawn(process.execPath, [tauriScript, 'dev', '--config', configJson], {
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, VITE_PORT: port.toString() }
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
