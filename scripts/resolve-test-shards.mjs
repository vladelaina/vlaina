import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const maxShards = getPositiveInteger(process.env.TEST_SHARD_MAX, 8);
const filesPerShard = getPositiveInteger(process.env.TEST_FILES_PER_SHARD, 64);
const testFilePattern = /(?:^|[/\\])[^/\\]+[._-](?:test|spec)\.[cm]?[jt]sx?$/;
const ignoredSegments = new Set(['.git', 'node_modules', 'dist', 'release', 'temp']);

const testFileCount = listTrackedFiles().filter((file) => testFilePattern.test(file)).length || 1;
const shardCount = Math.max(1, Math.min(maxShards, Math.ceil(testFileCount / filesPerShard)));
const matrix = {
  include: Array.from({ length: shardCount }, (_, index) => ({
    shard: `${index + 1}/${shardCount}`,
  })),
};

console.log(JSON.stringify(matrix));

function getPositiveInteger(value, fallback) {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function listTrackedFiles() {
  const git = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
  if (git.status === 0 && git.stdout.trim()) {
    return git.stdout.trim().split(/\r?\n/);
  }

  return listFilesRecursively(process.cwd());
}

function listFilesRecursively(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    if (ignoredSegments.has(entry)) continue;

    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listFilesRecursively(path));
      continue;
    }

    if (stat.isFile()) {
      files.push(relative(process.cwd(), path).split(sep).join('/'));
    }
  }

  return files;
}
