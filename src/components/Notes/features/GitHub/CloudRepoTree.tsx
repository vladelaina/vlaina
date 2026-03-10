import { useMemo } from 'react';
import { NotesSidebarEmptyState, NotesSidebarList } from '../Sidebar/NotesSidebarPrimitives';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { CloudTreeItem } from './CloudTreeItem';

interface CloudRepoTreeProps {
  repoId: number;
  depth: number;
}

export function CloudRepoTree({ repoId, depth }: CloudRepoTreeProps) {
  const repositories = useGithubReposStore((state) => state.repositories);
  const nodes = useGithubReposStore((state) => state.getRepoNodes(repoId));
  const repository = useMemo(
    () => repositories.find((item) => item.id === repoId) ?? null,
    [repoId, repositories]
  );

  if (!repository) return null;

  if (nodes.length === 0) {
    return <NotesSidebarEmptyState title="No markdown files" className="py-4" />;
  }

  return (
    <NotesSidebarList>
      {nodes.map((node) => (
        <CloudTreeItem
          key={node.path}
          node={node}
          repoId={repoId}
          branch={repository.defaultBranch}
          depth={depth}
        />
      ))}
    </NotesSidebarList>
  );
}
