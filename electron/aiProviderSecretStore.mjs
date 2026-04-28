import electron from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decodeSecretRecord, encodeSecretRecord } from './secureSecretRecord.mjs';

const { app, safeStorage } = electron;

export async function readSecretsStore() {
  const secretsDir = path.join(app.getPath('userData'), '.vlaina', 'secrets');
  const secretsPath = path.join(secretsDir, 'ai-provider-secrets.json');

  await mkdir(secretsDir, { recursive: true });

  try {
    const content = await readFile(secretsPath, 'utf8');
    const parsed = JSON.parse(content);
    const { record, needsMigration } = decodeSecretRecord(parsed, safeStorage);
    if (needsMigration) {
      await writeFile(secretsPath, JSON.stringify(encodeSecretRecord(record, safeStorage), null, 2));
    }
    return { secretsDir, secretsPath, data: record };
  } catch {
    return { secretsDir, secretsPath, data: {} };
  }
}

export async function writeSecretsStore(data) {
  const { secretsPath } = await readSecretsStore();
  await writeFile(secretsPath, JSON.stringify(encodeSecretRecord(data, safeStorage), null, 2));
}
