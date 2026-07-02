import { readFile } from 'node:fs/promises';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const tagName = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
const version = tagName.trim().replace(/^v/i, '');

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`Version/tag "${tagName}" is not a supported app version.`);
}

const packageJsonPath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

if (packageJson.version !== version) {
  fail(
    `Package version "${packageJson.version}" does not match release tag "${tagName}" (expected "${version}").`
  );
}

console.log(`Package version ${version} matches release tag ${tagName}`);
