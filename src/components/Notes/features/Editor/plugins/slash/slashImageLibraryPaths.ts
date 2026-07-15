import type { FileTreeNode } from '@/stores/notes/types';

const MAX_OPENED_FOLDER_IMAGES = 5000;

export function collectOpenedFolderImagePaths(nodes: readonly FileTreeNode[]): string[] {
  const paths: string[] = [];
  const stack = [...nodes].reverse();
  while (stack.length > 0 && paths.length < MAX_OPENED_FOLDER_IMAGES) {
    const node = stack.pop()!;
    if (node.isFolder) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    } else if (node.kind === 'image') {
      paths.push(node.path);
    }
  }
  return paths;
}

export function getImagePathRelativeToNote(imagePath: string, notePath?: string | null) {
  const imageSegments = imagePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const noteSegments = (notePath ?? '').replace(/\\/g, '/').split('/').filter(Boolean);
  noteSegments.pop();

  let shared = 0;
  while (
    shared < noteSegments.length &&
    shared < imageSegments.length &&
    noteSegments[shared] === imageSegments[shared]
  ) {
    shared += 1;
  }

  const relativeSegments = [
    ...Array.from({ length: noteSegments.length - shared }, () => '..'),
    ...imageSegments.slice(shared),
  ];
  return relativeSegments.join('/') || imageSegments.at(-1) || imagePath;
}
