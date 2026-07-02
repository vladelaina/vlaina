import { memo, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { themeDomStyleTokens } from '@/styles/themeTokens';

type SidebarIconMetrics = {
  commits: Record<string, number>;
  mounts: Record<string, number>;
  unmounts: Record<string, number>;
};

function getE2ESidebarIconMetrics(): SidebarIconMetrics | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const e2eWindow = window as unknown as {
    __vlainaE2E?: unknown;
    __vlainaE2ESidebarFileIconMetrics?: SidebarIconMetrics;
  };
  if (!e2eWindow.__vlainaE2E) {
    return null;
  }

  const metrics = e2eWindow.__vlainaE2ESidebarFileIconMetrics ?? {
    commits: {},
    mounts: {},
    unmounts: {},
  };
  e2eWindow.__vlainaE2ESidebarFileIconMetrics = metrics;
  return metrics;
}

function useSidebarFileIconE2EMetrics(metricKey: string): void {
  useEffect(() => {
    const metrics = getE2ESidebarIconMetrics();
    if (!metrics) {
      return;
    }

    metrics.commits[metricKey] = (metrics.commits[metricKey] ?? 0) + 1;
  });

  useEffect(() => {
    const metrics = getE2ESidebarIconMetrics();
    if (!metrics) {
      return;
    }

    metrics.mounts[metricKey] = (metrics.mounts[metricKey] ?? 0) + 1;

    return () => {
      const latestMetrics = getE2ESidebarIconMetrics();
      if (!latestMetrics) {
        return;
      }

      latestMetrics.unmounts[metricKey] = (latestMetrics.unmounts[metricKey] ?? 0) + 1;
    };
  }, [metricKey]);
}

export const SidebarNoteFileIcon = memo(function SidebarNoteFileIcon({
  icon,
  metricKey,
  notePath,
  size = NOTES_SIDEBAR_ICON_SIZE,
  notesRootPath,
}: {
  icon?: string | null;
  metricKey?: string;
  notePath: string;
  size?: number | string;
  notesRootPath?: string;
}) {
  const resolvedMetricKey = metricKey ?? notePath;
  useSidebarFileIconE2EMetrics(resolvedMetricKey);

  return (
    <span
      data-sidebar-note-file-icon="true"
      data-sidebar-note-file-icon-key={resolvedMetricKey}
      style={{
        display: themeDomStyleTokens.displayInlineFlex,
        width: size,
        height: size,
      }}
    >
      {icon ? (
        <NoteIcon icon={icon} notePath={notePath} notesRootPath={notesRootPath} size={size} />
      ) : (
        <Icon name="file.text" size={size} className="text-[var(--vlaina-sidebar-notes-file-icon)]" />
      )}
    </span>
  );
});

export const SidebarLiveNoteFileIcon = memo(function SidebarLiveNoteFileIcon({
  metricKey,
  notePath,
  size = NOTES_SIDEBAR_ICON_SIZE,
  notesRootPath,
}: {
  metricKey?: string;
  notePath: string;
  size?: number | string;
  notesRootPath?: string;
}) {
  const icon = useDisplayIcon(notePath);

  return (
    <SidebarNoteFileIcon
      icon={icon}
      metricKey={metricKey}
      notePath={notePath}
      size={size}
      notesRootPath={notesRootPath}
    />
  );
});
