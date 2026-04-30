type TitleCommitter = () => void | Promise<void>;

let currentTitleCommitter: TitleCommitter | null = null;

export function registerCurrentTitleCommitter(committer: TitleCommitter) {
  currentTitleCommitter = committer;

  return () => {
    if (currentTitleCommitter === committer) {
      currentTitleCommitter = null;
    }
  };
}

export async function flushCurrentTitleCommit() {
  await currentTitleCommitter?.();
}
