import { chmod, mkdir, writeFile } from 'node:fs/promises';

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

async function chmodIfSupported(filePath, mode) {
  try {
    await chmod(filePath, mode);
  } catch {
  }
}

export async function ensurePrivateDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true, mode: PRIVATE_DIR_MODE });
  await chmodIfSupported(dirPath, PRIVATE_DIR_MODE);
}

export async function writePrivateFile(filePath, content) {
  await writeFile(filePath, content, { encoding: 'utf8', mode: PRIVATE_FILE_MODE });
  await chmodIfSupported(filePath, PRIVATE_FILE_MODE);
}
