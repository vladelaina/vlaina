import { useI18n } from '@/lib/i18n';

export function GraphTopControls(props: { linkCount: number; nodeCount: number }) {
  const { t } = useI18n();

  return (
    <div
      data-graph-top-controls="true"
      data-graph-node-count={props.nodeCount}
      data-graph-link-count={props.linkCount}
      className="pointer-events-none absolute right-5 top-5 z-[var(--vlaina-z-20)] flex h-[var(--vlaina-size-40px)] items-center rounded-full border border-[var(--vlaina-color-toolbar-border)] bg-[var(--vlaina-color-graph-controls-bg)] px-4 shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]"
    >
      <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[length:var(--vlaina-font-13)] tabular-nums text-[var(--vlaina-color-text-secondary)]">
        <span>{t('graph.nodesCount', { count: props.nodeCount })}</span>
        <span>{t('graph.linksCount', { count: props.linkCount })}</span>
      </div>
    </div>
  );
}
