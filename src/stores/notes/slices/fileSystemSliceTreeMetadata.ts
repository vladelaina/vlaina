import { isDraftNotePath } from '../draftNote';
import { createEmptyMetadataFile } from '../storage';
import type { FileSystemSliceGet } from './fileSystemSliceContracts';

export function mergeDraftMetadata(
  metadata: ReturnType<typeof createEmptyMetadataFile>,
  currentMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
) {
  const draftMetadataEntries = Object.entries(currentMetadata?.notes ?? {})
    .filter(([path]) => isDraftNotePath(path));
  return draftMetadataEntries.length > 0
    ? {
        ...metadata,
        notes: {
          ...metadata.notes,
          ...Object.fromEntries(draftMetadataEntries),
        },
      }
    : metadata;
}
