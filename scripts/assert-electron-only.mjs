import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '..');

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'release',
  'temp',
]);

const ignoredTopLevelDirs = new Set([
  'docs',
  'vendor',
]);

const forbiddenPathMarkers = [
  'src-tauri',
  'tauri.conf',
];

const forbiddenContentMarkers = [
  '@tauri-apps/',
  '__TAURI__',
  'src-tauri',
  'tauri.conf',
];

const sourceExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsonc',
  '.mjs',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
]);

const findings = [];

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

function shouldSkipDir(dirPath) {
  const repoPath = toRepoPath(dirPath);
  const name = path.basename(dirPath);
  return ignoredDirs.has(name) || ignoredTopLevelDirs.has(repoPath);
}

function scanPathNames(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const repoPath = toRepoPath(fullPath);
    const lowerRepoPath = repoPath.toLowerCase();

    if (forbiddenPathMarkers.some((marker) => lowerRepoPath.includes(marker))) {
      findings.push(`Forbidden desktop runtime path: ${repoPath}`);
    }

    const info = statSync(fullPath);
    if (info.isDirectory()) {
      if (!shouldSkipDir(fullPath)) {
        scanPathNames(fullPath);
      }
      continue;
    }

    if (fullPath === currentFile || !sourceExtensions.has(path.extname(entry))) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf8');
    for (const marker of forbiddenContentMarkers) {
      if (content.includes(marker)) {
        findings.push(`Forbidden desktop runtime marker "${marker}" in ${repoPath}`);
      }
    }
  }
}

function checkPackageDependencies() {
  const packagePath = path.join(repoRoot, 'package.json');
  if (!existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const dependencyGroups = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];

  for (const group of dependencyGroups) {
    const dependencies = packageJson[group] ?? {};
    for (const dependencyName of Object.keys(dependencies)) {
      const normalized = dependencyName.toLowerCase();
      if (normalized.startsWith('@tauri-apps/') || normalized.includes('tauri')) {
        findings.push(`Forbidden dependency in ${group}: ${dependencyName}`);
      }
    }
  }
}

scanPathNames(repoRoot);
checkPackageDependencies();

if (findings.length > 0) {
  console.error('[ElectronOnly] Tauri runtime markers are not allowed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('[ElectronOnly] PASS');
