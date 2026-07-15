import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@/components/ui/icons';
import { SidebarSearchField } from '@/components/layout/sidebar/SidebarPrimitives';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { themeFileTreeTokens } from '@/styles/themeTokens';
import { chatComposerSecondaryButtonClass } from '@/components/Chat/features/Input/composerStyles';
import { collectOpenedFolderImagePaths } from './slashImageLibraryPaths';

const IMAGE_LIBRARY_COLUMNS = 3;

function LibraryImage({ notesPath, path, onSelect }: { notesPath: string; path: string; onSelect: () => void }) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !rootRef.current) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    void resolveNotesRootRelativeFullPath(notesPath, path)
      .then(({ fullPath }) => loadImageThumbnailAsBlob(fullPath, {
        maxEdgePx: themeFileTreeTokens.imageLibraryThumbnailDecodeEdgePx,
      }))
      .then((nextSrc) => {
        if (active) setSrc(nextSrc);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [notesPath, path, shouldLoad]);

  const name = path.split('/').pop() ?? path;
  return (
    <button
      ref={rootRef}
      type="button"
      data-image-library-item={path}
      onClick={onSelect}
      className="group h-full w-full min-w-0 overflow-hidden rounded-xl border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-secondary)] text-left transition-colors hover:border-[var(--vlaina-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-accent)]"
    >
      <span className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--vlaina-bg-tertiary)]">
        {src ? (
          <img src={src} alt={name} className="size-full object-cover" decoding="async" />
        ) : (
          <Icon name="file.image" size="lg" className="text-[var(--vlaina-text-tertiary)]" />
        )}
      </span>
    </button>
  );
}

export function OpenedFolderImageLibraryPanel({
  onSelect,
  onChooseComputer,
}: {
  onSelect: (path: string) => void;
  onChooseComputer: () => void;
}) {
  const { t } = useI18n();
  const notesPath = useNotesStore((state) => state.notesPath);
  const rootFolder = useNotesStore((state) => state.rootFolder);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const paths = useMemo(
    () => collectOpenedFolderImagePaths(rootFolder?.children ?? []),
    [rootFolder],
  );
  const visiblePaths = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? paths.filter((path) => path.toLowerCase().includes(normalizedQuery))
      : paths;
  }, [paths, query]);
  const rowCount = Math.ceil(visiblePaths.length / IMAGE_LIBRARY_COLUMNS);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRoot,
    estimateSize: () => themeFileTreeTokens.imageLibraryRowHeightPx,
    overscan: 2,
    initialRect: {
      width: themeFileTreeTokens.imageLibraryFallbackWidthPx,
      height: themeFileTreeTokens.imageLibraryFallbackHeightPx,
    },
    initialOffset: 0,
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement;
      if (!element) return;
      const update = () => callback({
        width: element.clientWidth || themeFileTreeTokens.imageLibraryFallbackWidthPx,
        height: element.clientHeight || themeFileTreeTokens.imageLibraryFallbackHeightPx,
      });
      update();
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
      observer?.observe(element);
      return () => observer?.disconnect();
    },
    observeElementOffset: (instance, callback) => {
      const element = instance.scrollElement;
      if (!element) return;
      const update = () => callback(element.scrollTop, false);
      update();
      element.addEventListener('scroll', update, { passive: true });
      return () => element.removeEventListener('scroll', update);
    },
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex max-h-full w-[var(--vlaina-size-420px)] max-w-full flex-col gap-2 p-2">
      <div className="flex gap-2">
        <SidebarSearchField
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClose={() => setQuery('')}
          placeholder={t('editor.imageLibrarySearchPlaceholder')}
          closeLabel={t('common.close')}
          className="min-w-0 flex-1 p-0"
          containerClassName="h-9 gap-1.5 pl-2 pr-1"
          inputClassName="text-sm"
          closeButtonClassName={cn(
            'h-5 w-5',
            query ? undefined : 'invisible pointer-events-none',
          )}
        />
        <button
          type="button"
          onClick={onChooseComputer}
          className={cn(
            chatComposerSecondaryButtonClass,
            'inline-flex shrink-0 items-center gap-2 text-[var(--vlaina-font-sm)] font-medium',
          )}
        >
          <Icon name="file.folderOpenArrow" size="sm" />
          {t('editor.imageLibraryChooseComputer')}
        </button>
      </div>

      <div ref={setScrollRoot} className="slash-image-library-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {visiblePaths.length > 0 ? (
            <div
              className="relative min-w-0"
              style={{ height: rowVirtualizer.getTotalSize() }}
              data-image-library-total-count={visiblePaths.length}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowStart = virtualRow.index * IMAGE_LIBRARY_COLUMNS;
                const rowPaths = visiblePaths.slice(rowStart, rowStart + IMAGE_LIBRARY_COLUMNS);
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className="absolute left-0 top-0 grid w-full min-w-0 grid-cols-3 gap-2 pb-2"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {rowPaths.map((path) => (
                      <LibraryImage key={path} notesPath={notesPath} path={path} onSelect={() => onSelect(path)} />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[var(--vlaina-size-180px)] flex-col items-center justify-center gap-2 text-center text-[var(--vlaina-text-secondary)]">
              <Icon name="file.image" size="xl" />
              <span>{t('editor.imageLibraryEmpty')}</span>
            </div>
          )}
      </div>
    </div>
  );
}
