import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { useStarredEntryIcon } from '@/components/Notes/features/Starred/useStarredEntryIcon';
import { cn } from '@/lib/utils';
import type { StarredEntry } from '@/stores/notes/types';
import type { NoteMentionCandidate } from '../noteMentionHelpers';
import { useI18n } from '@/lib/i18n';
import { chatComposerPillSurfaceClass } from '../composerStyles';
import {
  getSidebarIdleRowSurfaceClass,
  getSidebarSelectedRowSurfaceClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { NOTES_SIDEBAR_ICON_SIZE } from '@/components/Notes/features/Sidebar/sidebarLayout';

interface NoteMentionPickerProps {
  currentPageCandidates: NoteMentionCandidate[];
  folderCandidates: NoteMentionCandidate[];
  linkedPageCandidates: NoteMentionCandidate[];
  activeCandidatePath: string | null;
  status?: 'loading' | 'empty' | null;
  className?: string;
  onSelect: (candidate: NoteMentionCandidate) => void;
}

interface NoteMentionSectionProps {
  title: string;
  candidates: NoteMentionCandidate[];
  activeCandidatePath: string | null;
  onSelect: (candidate: NoteMentionCandidate) => void;
}

function NoteMentionCandidateIcon({ candidate }: { candidate: NoteMentionCandidate }) {
  if (candidate.kind === 'folder') {
    return (
      <Icon
        name="file.folder"
        size={NOTES_SIDEBAR_ICON_SIZE}
        className="text-[var(--notes-sidebar-folder-icon)]"
      />
    );
  }

  if (candidate.icon) {
    return (
      <NoteIcon
        icon={candidate.icon}
        notePath={candidate.notePath ?? candidate.path}
        vaultPath={candidate.vaultPath}
        size={NOTES_SIDEBAR_ICON_SIZE}
      />
    );
  }

  if (candidate.starredEntry) {
    return <StarredNoteMentionIcon candidate={candidate} entry={candidate.starredEntry} />;
  }

  return (
    <Icon
      name="file.text"
      size={NOTES_SIDEBAR_ICON_SIZE}
      className="text-[var(--notes-sidebar-file-icon)]"
    />
  );
}

function StarredNoteMentionIcon({
  candidate,
  entry,
}: {
  candidate: NoteMentionCandidate;
  entry: StarredEntry;
}) {
  const starredIcon = useStarredEntryIcon(entry, true);

  if (!starredIcon) {
    return (
      <Icon
        name="file.text"
        size={NOTES_SIDEBAR_ICON_SIZE}
        className="text-[var(--notes-sidebar-file-icon)]"
      />
    );
  }

  return (
    <NoteIcon
      icon={starredIcon}
      notePath={candidate.notePath ?? candidate.path}
      vaultPath={candidate.vaultPath}
      size={NOTES_SIDEBAR_ICON_SIZE}
    />
  );
}

function NoteMentionSection({
  title,
  candidates,
  activeCandidatePath,
  onSelect,
}: NoteMentionSectionProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeCandidatePath]);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--chat-sidebar-text-soft)]">
        {title}
      </p>
      <div className="space-y-1">
        {candidates.map((candidate) => {
          const isActive = candidate.path === activeCandidatePath;

          return (
            <button
              ref={isActive ? activeButtonRef : undefined}
              key={candidate.path}
              type="button"
              className={cn(
                'flex h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[15px] font-medium transition-colors',
                isActive
                  ? getSidebarSelectedRowSurfaceClass('chat')
                  : getSidebarIdleRowSurfaceClass('chat')
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(candidate)}
            >
              <span className="flex size-[18px] shrink-0 items-center justify-center">
                <NoteMentionCandidateIcon candidate={candidate} />
              </span>
              <span className="truncate">{candidate.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NoteMentionPicker({
  currentPageCandidates,
  folderCandidates,
  linkedPageCandidates,
  activeCandidatePath,
  status,
  className,
  onSelect,
}: NoteMentionPickerProps) {
  const { t } = useI18n();
  const hasCandidates =
    currentPageCandidates.length > 0 ||
    folderCandidates.length > 0 ||
    linkedPageCandidates.length > 0;

  return (
    <div
      className={cn(
        'absolute bottom-full z-40 mb-2 max-h-72 overflow-y-auto !rounded-[26px] p-1.5 text-[var(--chat-sidebar-text)]',
        chatComposerPillSurfaceClass,
        className ?? 'left-3 right-3',
      )}
      data-no-focus-input="true"
    >
      <div className="space-y-2">
        {hasCandidates ? (
          <>
            <NoteMentionSection
              title={t('chat.currentPage')}
              candidates={currentPageCandidates}
              activeCandidatePath={activeCandidatePath}
              onSelect={onSelect}
            />
            <NoteMentionSection
              title={t('chat.linkToPage')}
              candidates={linkedPageCandidates}
              activeCandidatePath={activeCandidatePath}
              onSelect={onSelect}
            />
            <NoteMentionSection
              title={t('notes.folder')}
              candidates={folderCandidates}
              activeCandidatePath={activeCandidatePath}
              onSelect={onSelect}
            />
          </>
        ) : (
          <p className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--chat-sidebar-text-soft)]">
            {status === 'loading' ? 'Loading notes...' : 'No matching notes'}
          </p>
        )}
      </div>
    </div>
  );
}
