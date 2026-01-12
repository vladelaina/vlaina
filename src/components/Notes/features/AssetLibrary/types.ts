/**
 * Asset Library Component Types
 */

export interface CoverPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assetPath: string) => void;
  vaultPath: string;
}

export interface AssetGridProps {
  onSelect: (assetPath: string) => void;
  vaultPath: string;
}

export interface UploadZoneProps {
  onUploadComplete: (assetPath: string) => void;
  onDuplicateDetected?: (existingFilename: string) => void;
}

export interface EmptyStateProps {
  onUploadClick: () => void;
}

export type CoverPickerTab = 'library' | 'upload';
