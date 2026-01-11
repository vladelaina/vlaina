/**
 * NewRepositoryDialog - Dialog for creating a new GitHub repository
 * 
 * Allows user to enter repository name (without nekotick- prefix)
 * and select public/private visibility.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2, Lock, Globe } from 'lucide-react';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { cn } from '@/lib/utils';

interface NewRepositoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewRepositoryDialog({ isOpen, onClose }: NewRepositoryDialogProps) {
  const { createRepository } = useGithubReposStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIsPrivate(true);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Repository name is required');
      return;
    }

    // Validate name (GitHub repo name rules)
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedName)) {
      setError('Name can only contain letters, numbers, hyphens, underscores, and periods');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const repo = await createRepository(
        trimmedName,
        isPrivate,
        description.trim() || undefined
      );
      
      if (repo) {
        onClose();
      } else {
        setError('Failed to create repository');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setIsCreating(false);
    }
  }, [name, description, isPrivate, createRepository, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className={cn(
        "relative w-full max-w-md mx-4 p-6 rounded-xl",
        "bg-[var(--neko-bg-primary)] border border-[var(--neko-border)]",
        "shadow-2xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--neko-text-primary)]">
            New Repository
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Name input */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[var(--neko-text-secondary)] mb-1.5">
              Repository name
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[var(--neko-text-tertiary)]">nekotick-</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-notes"
                disabled={isCreating}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg",
                  "bg-[var(--neko-bg-secondary)] border border-[var(--neko-border)]",
                  "text-[13px] text-[var(--neko-text-primary)]",
                  "placeholder:text-[var(--neko-text-tertiary)]",
                  "focus:outline-none focus:border-[var(--neko-accent)]",
                  "disabled:opacity-50"
                )}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--neko-text-tertiary)]">
              Will be created as: nekotick-{name || 'my-notes'}
            </p>
          </div>

          {/* Description input */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[var(--neko-text-secondary)] mb-1.5">
              Description <span className="text-[var(--neko-text-tertiary)]">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your repository"
              disabled={isCreating}
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-[var(--neko-bg-secondary)] border border-[var(--neko-border)]",
                "text-[13px] text-[var(--neko-text-primary)]",
                "placeholder:text-[var(--neko-text-tertiary)]",
                "focus:outline-none focus:border-[var(--neko-accent)]",
                "disabled:opacity-50"
              )}
            />
          </div>

          {/* Visibility selection */}
          <div className="mb-6">
            <label className="block text-[13px] font-medium text-[var(--neko-text-secondary)] mb-2">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={isCreating}
                className={cn(
                  "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors",
                  isPrivate
                    ? "border-[var(--neko-accent)] bg-[var(--neko-accent)]/10"
                    : "border-[var(--neko-border)] hover:border-[var(--neko-border-hover)]",
                  "disabled:opacity-50"
                )}
              >
                <Lock className={cn(
                  "w-4 h-4",
                  isPrivate ? "text-[var(--neko-accent)]" : "text-[var(--neko-text-tertiary)]"
                )} />
                <div className="text-left">
                  <div className={cn(
                    "text-[13px] font-medium",
                    isPrivate ? "text-[var(--neko-accent)]" : "text-[var(--neko-text-primary)]"
                  )}>
                    Private
                  </div>
                  <div className="text-[11px] text-[var(--neko-text-tertiary)]">
                    Only you can see
                  </div>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={isCreating}
                className={cn(
                  "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors",
                  !isPrivate
                    ? "border-[var(--neko-accent)] bg-[var(--neko-accent)]/10"
                    : "border-[var(--neko-border)] hover:border-[var(--neko-border-hover)]",
                  "disabled:opacity-50"
                )}
              >
                <Globe className={cn(
                  "w-4 h-4",
                  !isPrivate ? "text-[var(--neko-accent)]" : "text-[var(--neko-text-tertiary)]"
                )} />
                <div className="text-left">
                  <div className={cn(
                    "text-[13px] font-medium",
                    !isPrivate ? "text-[var(--neko-accent)]" : "text-[var(--neko-text-primary)]"
                  )}>
                    Public
                  </div>
                  <div className="text-[11px] text-[var(--neko-text-tertiary)]">
                    Anyone can see
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className={cn(
                "px-4 py-2 rounded-lg",
                "text-[13px] text-[var(--neko-text-secondary)]",
                "hover:bg-[var(--neko-hover)] transition-colors",
                "disabled:opacity-50"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)]",
                "text-[13px] text-white font-medium",
                "transition-colors disabled:opacity-50"
              )}
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreating ? 'Creating...' : 'Create Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
