export const NEKOTICK_REPO_PREFIX = 'nekotick-';
export const NEKOTICK_CONFIG_REPO = 'nekotick-config';
export const MANAGED_CONTENT_REPO_NAME_ERROR =
  'Only NekoTick cloud repositories can be accessed';
export const MANAGED_CONTENT_REPO_ACCESS_ERROR =
  'Only discovered NekoTick cloud repositories can be accessed';

function normalizeRepoName(name: string): string {
  return name.trim().toLowerCase();
}

export function isManagedConfigRepoName(name: string): boolean {
  return normalizeRepoName(name) === NEKOTICK_CONFIG_REPO;
}

export function isManagedContentRepoName(name: string): boolean {
  const normalized = normalizeRepoName(name);
  return normalized.startsWith(NEKOTICK_REPO_PREFIX) && normalized !== NEKOTICK_CONFIG_REPO;
}

export function normalizeManagedContentRepoName(name: string): string {
  const trimmed = name.trim();
  if (isManagedContentRepoName(trimmed)) {
    return trimmed;
  }
  return `${NEKOTICK_REPO_PREFIX}${trimmed}`;
}

export function assertManagedContentRepoName(name: string): void {
  if (!isManagedContentRepoName(name)) {
    throw new Error(MANAGED_CONTENT_REPO_NAME_ERROR);
  }
}

export function filterManagedContentRepositories<T extends { name: string }>(repos: T[]): T[] {
  return repos.filter((repo) => isManagedContentRepoName(repo.name));
}

export function hasManagedContentRepoAccess<
  T extends { owner: string; name: string }
>(repos: T[], owner: string, name: string): boolean {
  const normalizedOwner = normalizeRepoName(owner);
  const normalizedName = normalizeRepoName(name);

  return repos.some(
    (repo) =>
      isManagedContentRepoName(repo.name) &&
      normalizeRepoName(repo.owner) === normalizedOwner &&
      normalizeRepoName(repo.name) === normalizedName
  );
}

export function assertManagedContentRepoAccess<
  T extends { owner: string; name: string }
>(repos: T[], owner: string, name: string): void {
  if (!hasManagedContentRepoAccess(repos, owner, name)) {
    throw new Error(MANAGED_CONTENT_REPO_ACCESS_ERROR);
  }
}
