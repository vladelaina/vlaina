import electron from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decodeSecretRecord, encodeSecretRecord } from './secureSecretRecord.mjs';

const { app, safeStorage } = electron;

export function isSupportedAccountProvider(provider) {
  return provider === 'google' || provider === 'email';
}

export function normalizeDesktopAccountProvider(provider, fallback = null) {
  if (typeof provider !== 'string') {
    return fallback;
  }

  const normalized = provider.trim().toLowerCase();
  return isSupportedAccountProvider(normalized) ? normalized : fallback;
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

async function getAppStoreDir() {
  const storeDir = path.join(app.getPath('userData'), '.vlaina', 'store');
  await mkdir(storeDir, { recursive: true });
  return storeDir;
}

async function getAccountStorePaths() {
  const storeDir = await getAppStoreDir();
  return {
    metaPath: path.join(storeDir, 'account-meta.json'),
    secretsPath: path.join(storeDir, 'account-secrets.json'),
  };
}

export function createAccountCredentialStore({ desktopLegacySessionHeader }) {
  async function readStoredAccountCredentials() {
    const { metaPath, secretsPath } = await getAccountStorePaths();
    const meta = await readJsonFile(metaPath, null);
    const rawSecrets = await readJsonFile(secretsPath, null);
    const { record: secrets, needsMigration } = decodeSecretRecord(rawSecrets, safeStorage);
    if (needsMigration) {
      await writeFile(secretsPath, JSON.stringify(encodeSecretRecord(secrets, safeStorage), null, 2));
    }
    const provider = typeof meta?.provider === 'string' ? meta.provider.trim() : '';
    const username = typeof meta?.username === 'string' ? meta.username.trim() : '';
    const appSessionToken = typeof secrets?.appSessionToken === 'string' ? secrets.appSessionToken.trim() : '';

    if (!isSupportedAccountProvider(provider) || !username || !appSessionToken) {
      return null;
    }

    const credentials = {
      appSessionToken,
      provider,
      username,
      primaryEmail: typeof meta?.primaryEmail === 'string' ? meta.primaryEmail : null,
      avatarUrl: typeof meta?.avatarUrl === 'string' ? meta.avatarUrl : null,
      membershipTier:
        meta?.membershipTier === 'free' ||
        meta?.membershipTier === 'plus' ||
        meta?.membershipTier === 'pro' ||
        meta?.membershipTier === 'max' ||
        meta?.membershipTier === 'ultra'
          ? meta.membershipTier
          : null,
      membershipName:
        typeof meta?.membershipName === 'string' && meta.membershipName.trim()
          ? meta.membershipName.trim()
          : null,
      authenticatedAt:
        typeof meta?.authenticatedAt === 'number' && Number.isFinite(meta.authenticatedAt)
          ? meta.authenticatedAt
          : null,
    };
    return credentials;
  }

  async function writeStoredAccountCredentials(credentials) {
    const { metaPath, secretsPath } = await getAccountStorePaths();
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          provider: credentials.provider,
          username: credentials.username,
          primaryEmail: credentials.primaryEmail ?? null,
          avatarUrl: credentials.avatarUrl ?? null,
          membershipTier: credentials.membershipTier ?? null,
          membershipName: credentials.membershipName ?? null,
          authenticatedAt:
            typeof credentials.authenticatedAt === 'number' && Number.isFinite(credentials.authenticatedAt)
              ? credentials.authenticatedAt
              : null,
        },
        null,
        2
      )
    );
    await writeFile(
      secretsPath,
      JSON.stringify(
        encodeSecretRecord(
          {
            appSessionToken: credentials.appSessionToken,
          },
          safeStorage
        ),
        null,
        2
      )
    );
  }

  async function clearStoredAccountCredentials() {
    const { metaPath, secretsPath } = await getAccountStorePaths();
    await rm(metaPath, { force: true });
    await rm(secretsPath, { force: true });
  }

  async function rotateStoredSessionToken(headers) {
    const rotatedToken = headers.get(desktopLegacySessionHeader)?.trim();
    if (!rotatedToken) {
      return;
    }

    const current = await readStoredAccountCredentials();
    if (!current) {
      return;
    }

    await writeStoredAccountCredentials({
      ...current,
      appSessionToken: rotatedToken,
    });
  }

  return {
    readStoredAccountCredentials,
    writeStoredAccountCredentials,
    clearStoredAccountCredentials,
    rotateStoredSessionToken,
  };
}
