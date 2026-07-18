import {
  commitGitChanges,
  fetchGitStatus,
  getGitCommitDiff,
  getGitHistory,
  getGitStatus,
  getGitWorkingDiff,
  pullGitChanges,
  pushGitChanges,
} from './gitService.mjs';

const defaultGitService = {
  commit: commitGitChanges,
  commitDiff: getGitCommitDiff,
  fetch: fetchGitStatus,
  history: getGitHistory,
  pull: pullGitChanges,
  push: pushGitChanges,
  status: getGitStatus,
  workingDiff: getGitWorkingDiff,
};

export function registerDesktopGitIpc({ handleIpc, service = defaultGitService }) {
  handleIpc('desktop:git:status', (_event, rootPath) => service.status(rootPath));
  handleIpc('desktop:git:fetch', (_event, rootPath) => service.fetch(rootPath));
  handleIpc('desktop:git:working-diff', (_event, rootPath, filePath) => (
    service.workingDiff(rootPath, filePath)
  ));
  handleIpc('desktop:git:history', (_event, rootPath, limit) => service.history(rootPath, limit));
  handleIpc('desktop:git:commit-diff', (_event, rootPath, hash) => (
    service.commitDiff(rootPath, hash)
  ));
  handleIpc('desktop:git:commit', (_event, rootPath, options) => service.commit(rootPath, options));
  handleIpc('desktop:git:pull', (_event, rootPath) => service.pull(rootPath));
  handleIpc('desktop:git:push', (_event, rootPath) => service.push(rootPath));
}
