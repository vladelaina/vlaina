import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default async function beforeBuild({ appDir }) {
  const packageJsonPath = path.join(appDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const runtimeDependencies = {
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies,
  };

  if (Object.keys(runtimeDependencies).length > 0) {
    throw new Error('electron-builder-before-build skips node_modules packaging, but runtime dependencies are present.');
  }

  return false;
}
