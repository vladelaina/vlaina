import { randomUUID } from 'node:crypto';
import { realpath, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertAuthorizedFsPath } from './fsAccess.mjs';
import { GitCommandError, runGit } from './gitCommand.mjs';
import { parseGitHistory, parsePorcelainV2Status } from './gitParsing.mjs';
import {
  requireAllowedRemoteUrl,
  requireSafeRemoteName,
  resolveRelativeGitPath,
  sanitizeRemoteUrl,
} from './gitValidation.mjs';

const MAX_COMMIT_MESSAGE_CHARS = 16 * 1024;
const MAX_HISTORY_ENTRIES = 100;
const MAX_SELECTED_PATHS = 2000;
const REMOTE_CHECK_TIMEOUT_MS = 30_000;
const MUTATION_TIMEOUT_MS = 120_000;
const DIFF_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const nullDevicePath = process.platform === 'win32' ? 'NUL' : '/dev/null';

function samePath(left, right) {
  const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  return normalize(path.resolve(left)) === normalize(path.resolve(right));
}

function isNotRepositoryError(error) {
  return error instanceof GitCommandError && (
    error.stderr.includes('not a git repository')
    || error.stderr.includes('must be run in a work tree')
  );
}

async function resolveRepositoryRoot(rootPath, nullable = false) {
  const resolvedRoot = await assertAuthorizedFsPath(rootPath);
  const info = await stat(resolvedRoot).catch(() => null);
  if (!info?.isDirectory()) {
    if (nullable) return null;
    throw new Error('Git repository root must be an existing directory.');
  }

  let topLevelResult;
  try {
    topLevelResult = await runGit(resolvedRoot, ['rev-parse', '--show-toplevel']);
  } catch (error) {
    if (nullable && isNotRepositoryError(error)) return null;
    throw error;
  }

  const topLevel = path.resolve(topLevelResult.stdout.replace(/\r?\n$/, ''));
  const authorizedTopLevel = await assertAuthorizedFsPath(topLevel);
  const [realRoot, realTopLevel] = await Promise.all([
    realpath(resolvedRoot),
    realpath(authorizedTopLevel),
  ]);
  if (!samePath(realRoot, realTopLevel)) {
    throw new Error('Git operations require the exact authorized repository root.');
  }

  const workTree = await runGit(resolvedRoot, ['rev-parse', '--is-inside-work-tree']);
  if (workTree.stdout.trim() !== 'true') {
    if (nullable) return null;
    throw new Error('Git repository must have a working tree.');
  }
  return resolvedRoot;
}

async function readOptionalConfig(rootPath, key) {
  const result = await runGit(rootPath, ['config', '--get', key], { allowedExitCodes: [1] });
  return result.code === 0 ? result.stdout.replace(/\r?\n$/, '') : null;
}

async function readTracking(rootPath, branch, { allowOriginFallback = false, push = false } = {}) {
  let remote = await readOptionalConfig(rootPath, `branch.${branch}.remote`);
  let mergeRef = await readOptionalConfig(rootPath, `branch.${branch}.merge`);
  let setUpstream = false;
  if ((!remote || !mergeRef) && allowOriginFallback) {
    remote = 'origin';
    mergeRef = `refs/heads/${branch}`;
    setUpstream = true;
  }
  if (!remote || !mergeRef) return null;

  requireSafeRemoteName(remote);
  if (!mergeRef.startsWith('refs/heads/')) {
    throw new Error('Git upstream branch is invalid.');
  }
  const pushUrl = push ? await readOptionalConfig(rootPath, `remote.${remote}.pushurl`) : null;
  const remoteUrl = pushUrl ?? await readOptionalConfig(rootPath, `remote.${remote}.url`);
  return { mergeRef, remote, remoteUrl, setUpstream };
}

async function readStatus(rootPath) {
  const result = await runGit(rootPath, [
    'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all',
  ]);
  const parsed = parsePorcelainV2Status(result.stdout);
  const tracking = parsed.branch
    ? await readTracking(rootPath, parsed.branch) ?? await readTracking(rootPath, parsed.branch, {
        allowOriginFallback: true,
      })
    : null;
  return {
    rootPath,
    branch: parsed.branch,
    detached: parsed.detached,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    remoteUrl: sanitizeRemoteUrl(tracking?.remoteUrl),
    changes: parsed.changes,
  };
}

export async function getGitStatus(rootPath) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath, true);
  return resolvedRoot ? readStatus(resolvedRoot) : null;
}

export async function fetchGitStatus(rootPath) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  const status = await readStatus(resolvedRoot);
  if (!status.branch || status.detached) return status;
  const tracking = await readTracking(resolvedRoot, status.branch, { allowOriginFallback: true });
  if (!tracking?.remoteUrl) return status;
  requireAllowedRemoteUrl(tracking.remoteUrl);
  await runGit(resolvedRoot, [
    ...networkGitConfig, 'fetch', '--prune', tracking.remote,
  ], { timeout: REMOTE_CHECK_TIMEOUT_MS });
  return readStatus(resolvedRoot);
}

export async function getGitWorkingDiff(rootPath, filePath) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  const relativePath = resolveRelativeGitPath(resolvedRoot, filePath);
  const head = await runGit(resolvedRoot, ['rev-parse', '--verify', 'HEAD'], { allowedExitCodes: [128] });
  let patch;
  if (head.code === 0) {
    patch = (await runGit(resolvedRoot, [
      '--literal-pathspecs', 'diff', '--no-ext-diff', '--no-textconv', '--no-color', 'HEAD', '--', relativePath,
    ], { maxBuffer: DIFF_MAX_BUFFER_BYTES })).stdout;
  } else {
    const staged = await runGit(resolvedRoot, [
      '--literal-pathspecs', 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--', relativePath,
    ], { maxBuffer: DIFF_MAX_BUFFER_BYTES });
    const unstaged = await runGit(resolvedRoot, [
      '--literal-pathspecs', 'diff', '--no-ext-diff', '--no-textconv', '--no-color', '--', relativePath,
    ], { maxBuffer: DIFF_MAX_BUFFER_BYTES });
    patch = [staged.stdout, unstaged.stdout].filter(Boolean).join('\n');
  }
  if (patch) return patch;

  const tracked = await runGit(resolvedRoot, [
    '--literal-pathspecs', 'ls-files', '--error-unmatch', '--', relativePath,
  ], { allowedExitCodes: [1] });
  const fileInfo = tracked.code === 1 ? await stat(path.join(resolvedRoot, relativePath)).catch(() => null) : null;
  if (!fileInfo?.isFile()) return '';
  return (await runGit(resolvedRoot, [
    'diff', '--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--', nullDevicePath, relativePath,
  ], { allowedExitCodes: [1], maxBuffer: DIFF_MAX_BUFFER_BYTES })).stdout;
}

export async function getGitHistory(rootPath, limit = 10) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_ENTRIES) {
    throw new Error(`Git history limit must be between 1 and ${MAX_HISTORY_ENTRIES}.`);
  }
  const head = await runGit(resolvedRoot, ['rev-parse', '--verify', 'HEAD'], { allowedExitCodes: [128] });
  if (head.code !== 0) return [];
  const result = await runGit(resolvedRoot, [
    'log', '-z', `--max-count=${limit}`,
    '--pretty=format:%H%x00%h%x00%s%x00%an%x00%aI',
  ]);
  return parseGitHistory(result.stdout);
}

export async function getGitCommitDiff(rootPath, hash) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  if (typeof hash !== 'string' || !/^[0-9a-f]{7,64}$/i.test(hash)) {
    throw new Error('A valid Git commit hash is required.');
  }
  const verified = await runGit(resolvedRoot, ['rev-parse', '--verify', `${hash}^{commit}`]);
  const fullHash = verified.stdout.trim();
  return (await runGit(resolvedRoot, [
    'show', '--format=', '--no-ext-diff', '--no-textconv', '--no-color', fullHash, '--',
  ], { maxBuffer: DIFF_MAX_BUFFER_BYTES })).stdout;
}

function normalizeCommitOptions(options) {
  const message = options?.message;
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_COMMIT_MESSAGE_CHARS) {
    throw new Error('Git commit message must be a non-empty string within the size limit.');
  }
  const paths = options?.paths;
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > MAX_SELECTED_PATHS) {
    throw new Error('Git commit requires one or more selected file paths.');
  }
  return { message, paths };
}

export async function commitGitChanges(rootPath, options) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  const { message, paths } = normalizeCommitOptions(options);
  const selectedPaths = Array.from(new Set(await Promise.all(
    paths.map((filePath) => resolveRelativeGitPath(resolvedRoot, filePath)),
  )));
  const head = await runGit(resolvedRoot, ['rev-parse', '--verify', 'HEAD'], {
    allowedExitCodes: [128],
  });
  const originalIndexTree = (await runGit(resolvedRoot, ['write-tree'])).stdout.trim();
  const temporaryIndexPath = path.join(os.tmpdir(), `vlaina-git-index-${randomUUID()}`);
  let committed = false;
  try {
    const trackedPaths = new Set((await runGit(resolvedRoot, [
      '--literal-pathspecs', 'ls-files', '-z', '--', ...selectedPaths,
    ])).stdout.split('\0').filter(Boolean));
    const existingPaths = await Promise.all(selectedPaths.map(async (filePath) => (
      await stat(path.join(resolvedRoot, filePath)).catch(() => null) ? filePath : null
    )));
    const stageablePaths = selectedPaths.filter((filePath) => (
      trackedPaths.has(filePath) || existingPaths.includes(filePath)
    ));
    if (stageablePaths.length > 0) {
      await runGit(resolvedRoot, ['--literal-pathspecs', 'add', '--all', '--', ...stageablePaths], {
        timeout: MUTATION_TIMEOUT_MS,
      });
    }
    const env = { GIT_INDEX_FILE: temporaryIndexPath };
    await runGit(resolvedRoot, head.code === 0 ? ['read-tree', 'HEAD'] : ['read-tree', '--empty'], { env });
    await runGit(resolvedRoot, ['--literal-pathspecs', 'add', '--all', '--', ...selectedPaths], {
      env,
      timeout: MUTATION_TIMEOUT_MS,
    });
    await runGit(resolvedRoot, [
      'commit', '--no-gpg-sign', '--no-verify', '-m', message,
    ], { env, timeout: MUTATION_TIMEOUT_MS });
    committed = true;
  } finally {
    if (!committed) {
      await runGit(resolvedRoot, ['read-tree', originalIndexTree]).catch(() => {});
    }
    await Promise.all([
      rm(temporaryIndexPath, { force: true }),
      rm(`${temporaryIndexPath}.lock`, { force: true }),
    ]).catch(() => {});
  }
  return readStatus(resolvedRoot);
}

const networkGitConfig = [
  '-c', 'protocol.ext.allow=never',
  '-c', 'protocol.file.allow=never',
  '-c', 'core.sshCommand=ssh',
];

export async function pullGitChanges(rootPath) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  const status = await readStatus(resolvedRoot);
  if (!status.branch || status.detached) throw new Error('Git pull requires an attached branch.');
  const tracking = await readTracking(resolvedRoot, status.branch);
  if (!tracking) throw new Error('Git pull requires an upstream branch.');
  requireAllowedRemoteUrl(tracking.remoteUrl);
  await runGit(resolvedRoot, [
    ...networkGitConfig, 'pull', '--ff-only', tracking.remote, tracking.mergeRef,
  ], { timeout: MUTATION_TIMEOUT_MS });
  return readStatus(resolvedRoot);
}

export async function pushGitChanges(rootPath) {
  const resolvedRoot = await resolveRepositoryRoot(rootPath);
  const status = await readStatus(resolvedRoot);
  if (!status.branch || status.detached) throw new Error('Git push requires an attached branch.');
  const tracking = await readTracking(resolvedRoot, status.branch, {
    allowOriginFallback: true,
    push: true,
  });
  requireAllowedRemoteUrl(tracking?.remoteUrl);
  const args = tracking.setUpstream
    ? ['push', '--set-upstream', tracking.remote, 'HEAD']
    : ['push', tracking.remote, `HEAD:${tracking.mergeRef}`];
  await runGit(resolvedRoot, [...networkGitConfig, ...args], { timeout: MUTATION_TIMEOUT_MS });
  return readStatus(resolvedRoot);
}
