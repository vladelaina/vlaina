import { commitWebGithubChangeset } from '../webGithubChangeset';
import { githubFetch } from './client';

interface WebRepoContentsResponse {
  name: string;
  path: string;
  sha: string;
  size?: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

interface WebGitReferenceResponse {
  object: {
    sha: string;
  };
}

interface WebGitCommitLookupResponse {
  tree: {
    sha: string;
  };
}

interface WebGitTreeResponse {
  tree: Array<{
    path: string;
    size?: number | null;
    sha?: string | null;
    type: string;
  }>;
}

function decodeUtf8Base64(input: string): string {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function mapRepositoryInfo(repo: any) {
  return {
    id: repo.id,
    name: repo.name,
    displayName: repo.name.startsWith('nekotick-') ? repo.name.slice('nekotick-'.length) : repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    description: repo.description ?? null,
  };
}

export async function listWebGithubRepos() {
  const allRepos: any[] = [];
  let page = 1;

  while (page <= 10) {
    const repos = await githubFetch<any[]>(
      `/user/repos?per_page=100&page=${page}&sort=updated&direction=desc`
    );
    if (repos.length === 0) {
      break;
    }
    allRepos.push(...repos);
    page += 1;
  }

  return allRepos
    .filter((repo) => repo.name.startsWith('nekotick-') && repo.name !== 'nekotick-config')
    .map(mapRepositoryInfo);
}

export async function createWebGithubRepo(
  name: string,
  isPrivate: boolean,
  description?: string
) {
  const fullName = name.startsWith('nekotick-') ? name : `nekotick-${name}`;
  const repo = await githubFetch<any>('/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fullName,
      private: isPrivate,
      description,
      auto_init: true,
    }),
  });

  return mapRepositoryInfo(repo);
}

export async function getWebGithubRepoTreeRecursive(owner: string, repo: string, branch: string) {
  const reference = await githubFetch<WebGitReferenceResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`
  );
  const headCommitSha = reference.object.sha;

  const commitLookup = await githubFetch<WebGitCommitLookupResponse>(
    `/repos/${owner}/${repo}/git/commits/${headCommitSha}`
  );
  const tree = await githubFetch<WebGitTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${commitLookup.tree.sha}?recursive=1`
  );

  return tree.tree
    .filter((entry) => entry.sha)
    .map((entry) => ({
      path: entry.path,
      name: entry.path.split('/').pop() || entry.path,
      entryType: entry.type === 'tree' ? ('dir' as const) : ('file' as const),
      sha: entry.sha || '',
      size: entry.size ?? undefined,
    }));
}

export async function getWebGithubFileContent(owner: string, repo: string, path: string) {
  const content = await githubFetch<WebRepoContentsResponse>(`/repos/${owner}/${repo}/contents/${path}`);
  const decodedContent = decodeUtf8Base64((content.content ?? '').replace(/\n/g, ''));
  return {
    path: content.path,
    content: decodedContent,
    sha: content.sha,
    encoding: content.encoding ?? 'base64',
  };
}

export async function commitWebRepoChangeset(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  operations: Array<{
    operationType: 'upsert' | 'delete';
    path: string;
    content?: string;
    previousSha?: string | null;
  }>
) {
  return commitWebGithubChangeset({
    githubFetch,
    owner,
    repo,
    branch,
    message,
    operations,
  });
}
