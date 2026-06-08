interface ExternalPathMutation {
  revision: number;
  path: string;
}

const MAX_EXTERNAL_PATH_MUTATIONS = 256;

let externalPathMutationRevision = 0;
const externalPathMutations: ExternalPathMutation[] = [];

function isPathWithin(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function markExternalPathMutation(path: string): void {
  externalPathMutationRevision += 1;
  externalPathMutations.push({ revision: externalPathMutationRevision, path });
  if (externalPathMutations.length > MAX_EXTERNAL_PATH_MUTATIONS) {
    externalPathMutations.splice(0, externalPathMutations.length - MAX_EXTERNAL_PATH_MUTATIONS);
  }
}

export function getExternalPathMutationRevision(): number {
  return externalPathMutationRevision;
}

export function markExternalPathDeletion(path: string): void {
  markExternalPathMutation(path);
}

export function markExternalPathRename(oldPath: string): void {
  markExternalPathMutation(oldPath);
}

export function wasPathExternallyMutatedSince(path: string, revision: number): boolean {
  if (externalPathMutationRevision === revision) {
    return false;
  }

  for (let index = externalPathMutations.length - 1; index >= 0; index -= 1) {
    const mutation = externalPathMutations[index];
    if (mutation.revision <= revision) {
      break;
    }
    if (isPathWithin(path, mutation.path)) {
      return true;
    }
  }

  return false;
}
