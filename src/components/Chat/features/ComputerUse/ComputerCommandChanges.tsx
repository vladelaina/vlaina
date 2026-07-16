import type { ComputerFileChange } from '@/lib/ai/computerUse/types';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const KIND_KEYS: Record<ComputerFileChange['kind'], MessageKey> = {
  added: 'chat.computerUse.fileAdded',
  modified: 'chat.computerUse.fileModified',
  deleted: 'chat.computerUse.fileDeleted',
};

function Patch({ value }: { value: string }) {
  return (
    <pre className="mt-2 max-h-[var(--vlaina-size-320px)] overflow-auto whitespace-pre font-mono text-[var(--vlaina-font-xs)] leading-5">
      {value.split('\n').map((line, index) => (
        <span
          className={cn(
            'block min-w-max',
            line.startsWith('+') && !line.startsWith('+++') && 'text-[var(--vlaina-color-status-success-fg)]',
            line.startsWith('-') && !line.startsWith('---') && 'text-[var(--vlaina-color-danger)]',
            line.startsWith('@@') && 'text-[var(--vlaina-accent)]',
          )}
          key={index}
        >
          {line || ' '}
        </span>
      ))}
    </pre>
  );
}

export function ComputerCommandChanges({
  changes,
  truncated,
}: {
  changes: ComputerFileChange[];
  truncated?: boolean;
}) {
  const { t } = useI18n();
  if (changes.length === 0) return null;
  const additions = changes.reduce((total, change) => total + change.additions, 0);
  const deletions = changes.reduce((total, change) => total + change.deletions, 0);

  return (
    <details className="mt-2 border-t border-[var(--vlaina-border)] pt-2">
      <summary className="cursor-pointer select-none font-medium text-[var(--vlaina-text-secondary)]">
        {t('chat.computerUse.fileChanges', { count: changes.length })}
        <span className="ml-2 text-[var(--vlaina-color-status-success-fg)]">+{additions}</span>
        <span className="ml-1 text-[var(--vlaina-color-danger)]">-{deletions}</span>
      </summary>
      <div className="mt-2 space-y-3">
        {changes.map((change, index) => (
          <details
            className={index > 0 ? 'border-t border-[var(--vlaina-border)] pt-3' : undefined}
            key={`${change.path}-${index}`}
          >
            <summary className="cursor-pointer select-none text-[var(--vlaina-text-primary)]">
              <span className="mr-2 text-[var(--vlaina-text-tertiary)]">{t(KIND_KEYS[change.kind])}</span>
              <span className="break-all font-mono">{change.path}</span>
              <span className="ml-2 whitespace-nowrap">
                <span className="text-[var(--vlaina-color-status-success-fg)]">+{change.additions}</span>
                <span className="ml-1 text-[var(--vlaina-color-danger)]">-{change.deletions}</span>
              </span>
            </summary>
            {change.patch ? <Patch value={change.patch} /> : (
              <div className="mt-1 text-[var(--vlaina-text-tertiary)]">
                {t('chat.computerUse.fileDiffUnavailable')}
              </div>
            )}
          </details>
        ))}
        {truncated ? (
          <div className="text-[var(--vlaina-color-danger)]">
            {t('chat.computerUse.fileChangesIncomplete')}
          </div>
        ) : null}
      </div>
    </details>
  );
}
