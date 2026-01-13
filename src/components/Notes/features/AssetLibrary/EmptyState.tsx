/**
 * EmptyState - Shown when asset library is empty
 */

import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyStateProps } from './types';
import { cn } from '@/lib/utils';

export function EmptyState({ onUploadClick, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4", compact ? "py-6" : "py-12")}>
      <div className={cn(
        "rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center mb-3",
        compact ? "w-10 h-10" : "w-16 h-16 mb-4"
      )}>
        <ImagePlus className={cn("text-[var(--neko-text-tertiary)]", compact ? "w-5 h-5" : "w-8 h-8")} />
      </div>
      
      <p className={cn(
        "text-[var(--neko-text-secondary)] text-center mb-3",
        compact ? "text-xs" : "text-sm mb-4 max-w-[200px]"
      )}>
        {compact ? "No images yet" : "Upload images to use as covers for your notes"}
      </p>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onUploadClick}
        className="gap-1.5 text-xs"
      >
        <ImagePlus className="w-3.5 h-3.5" />
        Upload
      </Button>
    </div>
  );
}
