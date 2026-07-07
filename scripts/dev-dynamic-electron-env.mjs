import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export function normalizeElectronDesktopEnv(env, options = {}) {
  const {
    fsModule = fs,
    log = () => {},
  } = options;
  if (process.platform !== 'linux') {
    return env;
  }

  const next = { ...env };
  const hasWaylandDisplay = typeof next.WAYLAND_DISPLAY === 'string' && next.WAYLAND_DISPLAY.trim().length > 0;
  const hasX11Display = typeof next.DISPLAY === 'string' && next.DISPLAY.trim().length > 0;
  const sessionType = typeof next.XDG_SESSION_TYPE === 'string' ? next.XDG_SESSION_TYPE.trim().toLowerCase() : '';

  if (hasWaylandDisplay && (!sessionType || sessionType === 'tty')) {
    next.XDG_SESSION_TYPE = 'wayland';
    log('33', 'Adjusted Electron XDG_SESSION_TYPE=wayland for desktop dialogs');
  } else if (hasX11Display && (!sessionType || sessionType === 'tty')) {
    next.XDG_SESSION_TYPE = 'x11';
    log('33', 'Adjusted Electron XDG_SESSION_TYPE=x11 for desktop dialogs');
  }

  if (!next.GTK_USE_PORTAL) {
    next.GTK_USE_PORTAL = '0';
    log('33', 'Adjusted Electron GTK_USE_PORTAL=0 for desktop dialogs');
  }

  if (!next.XDG_CURRENT_DESKTOP) {
    if (typeof next.DESKTOP_SESSION === 'string' && next.DESKTOP_SESSION.trim()) {
      next.XDG_CURRENT_DESKTOP = next.DESKTOP_SESSION.trim();
      log('33', `Adjusted Electron XDG_CURRENT_DESKTOP=${next.XDG_CURRENT_DESKTOP} from DESKTOP_SESSION`);
    } else if (
      fsModule.existsSync('/usr/share/xdg-desktop-portal/gtk-portals.conf')
      && fsModule.existsSync('/usr/share/xdg-desktop-portal/niri-portals.conf')
    ) {
      next.XDG_CURRENT_DESKTOP = 'gtk';
      log('33', 'Adjusted Electron XDG_CURRENT_DESKTOP=gtk to avoid broken niri GNOME portal fallback');
    } else if (fsModule.existsSync('/usr/share/xdg-desktop-portal/niri-portals.conf')) {
      next.XDG_CURRENT_DESKTOP = 'niri';
      log('33', 'Adjusted Electron XDG_CURRENT_DESKTOP=niri for xdg-desktop-portal');
    } else {
      log('33', 'XDG_CURRENT_DESKTOP is not set; Linux file dialogs may require xdg-desktop-portal configuration');
    }
  }

  return next;
}

export function updateLinuxDesktopActivationEnvironment(env, state, options = {}) {
  const {
    log = () => {},
    spawnSyncFn = spawnSync,
  } = options;
  if (state.updated || process.platform !== 'linux') {
    return;
  }

  state.updated = true;

  const variables = [
    'WAYLAND_DISPLAY',
    'DISPLAY',
    'XDG_CURRENT_DESKTOP',
    'XDG_SESSION_TYPE',
    'DESKTOP_SESSION',
    'DBUS_SESSION_BUS_ADDRESS',
  ]
    .filter((name) => typeof env[name] === 'string' && env[name].trim().length > 0)
    .map((name) => `${name}=${env[name]}`);

  if (variables.length === 0) {
    return;
  }

  const result = spawnSyncFn('dbus-update-activation-environment', ['--systemd', ...variables], {
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status === 0) {
    log('33', 'Updated D-Bus/systemd desktop activation environment for Linux dialogs');
    return;
  }

  const message = (result.stderr || result.stdout || '').trim();
  log('33', `Failed to update D-Bus/systemd desktop activation environment${message ? `: ${message}` : ''}`);
}
