const SECURE_LINUX_STORAGE_BACKENDS = new Set([
  'gnome_libsecret',
  'kwallet',
  'kwallet5',
  'kwallet6',
]);

function isNiriDesktop(env) {
  return [env.XDG_CURRENT_DESKTOP, env.XDG_SESSION_DESKTOP, env.DESKTOP_SESSION]
    .filter((value) => typeof value === 'string')
    .some((value) => value.toLowerCase().split(/[:;,]/).includes('niri'));
}

export function configureLinuxSafeStorageBackend({
  app,
  env = process.env,
  platform = process.platform,
}) {
  if (platform !== 'linux' || !isNiriDesktop(env)) {
    return false;
  }

  app.commandLine.appendSwitch('password-store', 'gnome-libsecret');
  return true;
}

export function isSafeStoragePersistenceAvailable(
  safeStorage,
  platform = process.platform,
) {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    return false;
  }
  if (platform !== 'linux') {
    return true;
  }

  try {
    return SECURE_LINUX_STORAGE_BACKENDS.has(
      safeStorage.getSelectedStorageBackend?.(),
    );
  } catch {
    return false;
  }
}
