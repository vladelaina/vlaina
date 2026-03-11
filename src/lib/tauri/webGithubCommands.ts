import {
  disconnectWebGithub,
  exchangeWebGithubCode,
  getWebGithubStatus,
  parseWebGithubOAuthCallback,
  startWebGithubAuth,
  updateWebGithubLastSyncTime,
} from './webGithub/auth';
import {
  commitWebRepoChangeset,
  createWebGithubRepo,
  getWebGithubFileContent,
  getWebGithubRepoTreeRecursive,
  listWebGithubRepos,
} from './webGithub/repoApi';

export const webGithubCommands = {
  startAuth: startWebGithubAuth,
  exchangeCode: exchangeWebGithubCode,
  getStatus: getWebGithubStatus,
  disconnect: disconnectWebGithub,
  updateLastSyncTime: updateWebGithubLastSyncTime,
  listRepos: listWebGithubRepos,
  createRepo: createWebGithubRepo,
  getRepoTreeRecursive: getWebGithubRepoTreeRecursive,
  getFileContent: getWebGithubFileContent,
  commitChangeset: commitWebRepoChangeset,
};

export function handleOAuthCallback(): { code: string; state: string } | null {
  return parseWebGithubOAuthCallback();
}
