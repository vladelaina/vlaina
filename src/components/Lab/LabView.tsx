import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useUIStore } from '@/stores/uiSlice';
import { LAB_MODULES, type LabId } from './config';
import { useI18n } from '@/lib/i18n';

export function LabView() {
  const { t } = useI18n();
  const [activeLabId, setActiveLabId] = useState<LabId | null>(LAB_MODULES[0]?.id ?? null);
  const { setAppViewMode } = useUIStore();

  const activeModule = LAB_MODULES.find((m) => m.id === activeLabId) ?? LAB_MODULES[0] ?? null;
  const ActiveComponent = activeModule?.component ?? null;

  return (
    <div className="h-full flex flex-col bg-[var(--vlaina-bg-primary)] overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] flex-none h-14 min-w-0">
        <button
          onClick={() => setAppViewMode('notes')}
          className="shrink-0 p-1.5 hover:bg-[var(--vlaina-hover)] rounded-lg text-[var(--vlaina-color-text-soft)] hover:text-[var(--vlaina-color-text-strong)] transition-colors"
          title={t('lab.exit')}
        >
          <Icon name="nav.chevronLeft" size="md" />
        </button>

        <div className="h-4 w-[1px] bg-[var(--vlaina-border)] mx-1 shrink-0" />

        <div className="min-w-0 flex-1 overflow-x-auto vlaina-scrollbar">
          <div className="flex items-center gap-1 min-w-max pr-4">
            {LAB_MODULES.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveLabId(module.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  activeLabId === module.id
                    ? 'bg-[var(--vlaina-color-status-info-bg)] text-[var(--vlaina-color-status-info-fg)]'
                    : 'text-[var(--vlaina-color-text-soft)] hover:text-[var(--vlaina-color-text-strong)] hover:bg-[var(--vlaina-hover)]'
                )}
              >
                {module.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-[var(--vlaina-bg-secondary)]">
        <div className="absolute inset-0 overflow-y-auto vlaina-scrollbar p-8">
          {ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <div className="rounded-3xl border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] px-8 py-10 text-center shadow-[var(--vlaina-shadow-panel-soft)]">
                <div className="text-[15px] font-semibold text-[var(--vlaina-color-text-strong)]">{t('lab.noModules')}</div>
                <div className="mt-2 text-[13px] text-[var(--vlaina-color-text-soft)]">{t('lab.empty')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
