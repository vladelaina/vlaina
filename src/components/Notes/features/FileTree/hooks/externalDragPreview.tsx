import { createRoot, type Root } from 'react-dom/client';
import { Icon, type IconName } from '@/components/ui/icons';
import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';

const PREVIEW_OFFSET_X = 20;
const PREVIEW_OFFSET_Y = 14;
const PREVIEW_MIN_WIDTH_PX = 180;
const PREVIEW_MAX_WIDTH_PX = 280;

type ExternalDragPreviewKind = 'file' | 'folder' | 'mixed';

interface ExternalDragPreviewState {
  count: number;
  kind: ExternalDragPreviewKind;
  label: string;
}

export interface ExternalDragPreviewHandle {
  updatePaths: (paths: string[]) => void;
  updatePosition: (clientX: number, clientY: number) => void;
  dispose: () => void;
}

function applyPreviewElementStyles(element: HTMLElement) {
  element.style.position = 'fixed';
  element.style.left = '0';
  element.style.top = '0';
  element.style.minWidth = `${PREVIEW_MIN_WIDTH_PX}px`;
  element.style.maxWidth = `${PREVIEW_MAX_WIDTH_PX}px`;
  element.style.pointerEvents = 'none';
  element.style.zIndex = '9999';
  element.style.margin = '0';
  element.style.opacity = '0.92';
  element.style.transform = 'translate3d(-9999px, -9999px, 0)';
  element.style.boxShadow = '0 14px 32px rgba(15, 23, 42, 0.18)';
  element.style.filter = 'saturate(1.02)';
  element.style.willChange = 'transform';
  element.classList.add('rounded-md');
}

function getKindIconName(kind: ExternalDragPreviewKind): IconName {
  if (kind === 'folder') {
    return 'file.folder';
  }

  if (kind === 'mixed') {
    return 'file.attach';
  }

  return 'file.text';
}

function ExternalDragPreviewCard({ count, kind, label }: ExternalDragPreviewState) {
  return (
    <div className="flex h-[30px] items-center gap-2 rounded-md bg-[var(--notes-sidebar-surface)] px-3 py-1 text-sm text-[var(--notes-sidebar-text)]">
      <span className="flex size-[20px] shrink-0 items-center justify-center">
        <Icon
          name={getKindIconName(kind)}
          size={16}
          className={kind === 'folder' ? 'text-[var(--notes-sidebar-folder-icon)]' : 'text-[var(--notes-sidebar-file-icon)]'}
        />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count > 1 ? (
        <span className="shrink-0 rounded-full bg-[var(--notes-sidebar-row-hover)] px-2 py-[1px] text-[11px] font-medium text-[var(--notes-sidebar-text-muted)]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function buildPreviewState(paths: string[], kind: ExternalDragPreviewKind): ExternalDragPreviewState {
  const count = paths.length;
  const firstPath = paths[0] ?? '';
  const firstLabel = getBaseName(firstPath) || 'Untitled';

  if (count <= 1) {
    return {
      count: 1,
      kind,
      label: firstLabel,
    };
  }

  return {
    count,
    kind,
    label: `${firstLabel} +${count - 1}`,
  };
}

export function createExternalDragPreview(paths: string[]): ExternalDragPreviewHandle {
  const hostElement = document.createElement('div');
  applyPreviewElementStyles(hostElement);
  document.body.appendChild(hostElement);

  const previousBodyCursor = document.body.style.cursor;
  document.body.style.cursor = 'grabbing';

  const root: Root = createRoot(hostElement);
  const storage = getStorageAdapter();
  let destroyed = false;
  let requestToken = 0;

  const renderState = (state: ExternalDragPreviewState) => {
    root.render(<ExternalDragPreviewCard {...state} />);
  };

  const updatePaths = (nextPaths: string[]) => {
    const validPaths = nextPaths.filter(Boolean);
    if (validPaths.length === 0) {
      return;
    }

    requestToken += 1;
    const token = requestToken;
    const fallbackKind: ExternalDragPreviewKind = validPaths.length > 1 ? 'mixed' : 'file';
    renderState(buildPreviewState(validPaths, fallbackKind));

    if (validPaths.length !== 1) {
      return;
    }

    void storage.stat(validPaths[0]).then((info) => {
      if (destroyed || token !== requestToken) {
        return;
      }

      renderState(buildPreviewState(validPaths, info?.isDirectory ? 'folder' : 'file'));
    }).catch(() => {
    });
  };

  updatePaths(paths);

  return {
    updatePaths,
    updatePosition: (clientX: number, clientY: number) => {
      hostElement.style.transform = `translate3d(${Math.round(clientX - PREVIEW_OFFSET_X)}px, ${Math.round(clientY - PREVIEW_OFFSET_Y)}px, 0)`;
    },
    dispose: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      document.body.style.cursor = previousBodyCursor;
      root.unmount();
      hostElement.remove();
    },
  };
}
