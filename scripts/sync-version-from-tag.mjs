import { readFile, writeFile } from 'node:fs/promises';

const tagName = process.env.GITHUB_REF_NAME ?? process.argv[2] ?? '';
const version = tagName.trim().replace(/^v/i, '');

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Tag "${tagName}" is not a supported app version tag.`);
}

const packageJsonPath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

packageJson.version = version;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Synced package version to ${version}`);
