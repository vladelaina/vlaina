/**
 * Asset Library Component Types
 */

export interface CoverPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assetPath: string) => void;
  onRemove?: () => void;
  onPreview?: (assetPath: string | null) => void;
  vaultPath: string;
}

export interface AssetGridProps {
  onSelect: (assetPath: string) => void;
  onHover?: (assetPath: string | null) => void;
  vaultPath: string;
  compact?: boolean;
  itemSize?: number;
  category?: 'covers' | 'icons';
}

export interface UploadZoneProps {
  onUploadComplete: (assetPath: string) => void;
  onDuplicateDetected?: (existingFilename: string) => void;
  compact?: boolean;
}

export interface EmptyStateProps {
  onUploadClick: () => void;
  compact?: boolean;
}

export type CoverPickerTab = 'library' | 'upload';