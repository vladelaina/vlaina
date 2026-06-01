import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export interface HealthStatus {
    status: 'loading' | 'success' | 'error';
    latency?: number;
    error?: string;
}

export function formatBenchmarkLatency(latency?: number) {
  if (typeof latency !== 'number' || Number.isNaN(latency)) {
    return null;
  }

  const seconds = latency / 1000;
  const formatted = seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1);

  return `${formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}s`;
}

interface ModelListItemProps {
  modelId: string;
  isAdded: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  health?: HealthStatus;
}

export function ModelListItem({ modelId, isAdded, onAdd, onRemove, health }: ModelListItemProps) {
  const { t } = useI18n();
  const showAddAction = !isAdded && !!onAdd;

  return (
    <div className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors duration-[var(--vlaina-duration-150)]",
        showAddAction
            ? "bg-[var(--vlaina-color-setting-field)] border-[var(--vlaina-border)] hover:bg-[var(--vlaina-hover-filled)]"
            : "bg-[var(--vlaina-bg-secondary)] border-[var(--vlaina-border)]"
    )}>
        <div className="flex-1 min-w-0">
            <div className={cn(
                "text-sm truncate",
                showAddAction
                    ? "font-medium text-[var(--vlaina-sidebar-notes-text)]"
                    : "font-medium text-[var(--vlaina-sidebar-notes-text-soft)]"
            )}>
                {modelId}
            </div>
        </div>

        {health && (
            <div className="flex items-center gap-1.5 mr-2">
                {health.status === 'loading' && (
                    <div className="size-3 rounded-full border-2 border-[var(--vlaina-border)] border-t-[var(--vlaina-accent)] animate-spin" />
                )}
                {health.status === 'success' && (
                    <span className="text-[var(--vlaina-font-10)] font-mono text-[var(--vlaina-color-status-success-fg)] bg-[var(--vlaina-color-status-success-bg)] px-1.5 py-0.5 rounded">
                        {formatBenchmarkLatency(health.latency)}
                    </span>
                )}
                {health.status === 'error' && (
                    <div className="text-[var(--vlaina-color-status-danger-fg)] cursor-help" title={health.error}>
                        <Icon name="common.error" size="sm" />
                    </div>
                )}
            </div>
        )}

        {isAdded ? (
            onRemove ? (
                <button 
                    onClick={onRemove} 
                    className="p-1.5 text-[var(--vlaina-color-status-danger-fg)] hover:bg-[var(--vlaina-color-status-danger-bg)] rounded-md transition-colors" 
                    title={t('common.remove')}
                >
                    <Icon name="common.delete" className="w-4 h-4" />
                </button>
            ) : (
                <div className="text-[var(--vlaina-color-status-success-fg)] px-1.5 flex items-center gap-1.5">
                    <Icon name="common.check" className="w-4 h-4" />
                    <span className="text-[var(--vlaina-font-11)] font-medium">{t('common.added')}</span>
                </div>
            )
        ) : showAddAction ? (
            <button 
                onClick={onAdd} 
                className="p-1 rounded-md text-[var(--vlaina-sidebar-notes-text-soft)] hover:text-[var(--vlaina-sidebar-notes-text)] hover:bg-[var(--vlaina-hover-filled)] transition-colors"
                title={t('common.add')}
            >
                <Icon name="common.add" className="w-4 h-4" />
            </button>
        ) : null}
    </div>
  );
}
