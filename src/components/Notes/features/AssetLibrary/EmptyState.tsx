/**
 * EmptyState - Shown when asset library is empty
 */

import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyStateProps } from './types';

export function EmptyState({ onUploadClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center mb-4">
        <ImagePlus className="w-8 h-8 text-[var(--neko-text-tertiary)]" />
      </div>
      
      <h3 className="text-[var(--neko-text-primary)] font-medium mb-1">
        No images yet
      </h3>
      
      <p className="text-[var(--neko-text-secondary)] text-sm text-center mb-4 max-w-[200px]">
        Upload images to use as covers for your notes
      </p>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onUploadClick}
        className="gap-2"
      >
        <ImagePlus className="w-4 h-4" />
        Upload Image
      </Button>
    </div>
  );
}
