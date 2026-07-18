import { useEffect, useState } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Button } from '@/components/ui/button';
import {
  getElectronBridge,
  type ElectronComputerCommandApproval,
} from '@/lib/electron/bridge';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function ComputerCommandApprovalSettings() {
  const { t } = useI18n();
  const computer = getElectronBridge()?.computer;
  const [approvals, setApprovals] = useState<ElectronComputerCommandApproval[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!computer) return;
    let active = true;
    void computer.listApprovals().then(
      (items) => {
        if (active) setApprovals(items);
      },
      () => {
        if (active) setApprovals([]);
      },
    );
    return () => {
      active = false;
    };
  }, [computer]);

  if (!computer || approvals === null) return null;

  const revoke = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      if (await computer.revokeApproval(id)) {
        setApprovals((items) => items?.filter((item) => item.id !== id) ?? []);
      }
    } catch {
      // Keep the current list when the desktop store cannot be updated.
    } finally {
      setBusyId(null);
    }
  };

  const clear = async () => {
    if (busyId) return;
    setBusyId('*');
    try {
      if (await computer.clearApprovals()) setApprovals([]);
    } catch {
      // Keep the current list when the desktop store cannot be updated.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="mx-auto mb-10 max-w-5xl"
      data-settings-control="computer-command-approvals"
    >
      <div className="mb-4 px-2">
        <h3 className="text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text-soft)]">
          {t('settings.ai.computerPermissions')}
        </h3>
        <p className="mt-1 max-w-[var(--vlaina-size-600px)] text-[var(--vlaina-font-xs)] leading-normal text-[var(--vlaina-sidebar-notes-text-soft)]">
          {t('settings.ai.computerPermissionsDescription')}
        </p>
      </div>

      <div className={cn('min-w-0 overflow-hidden rounded-[var(--vlaina-radius-26px)] p-2', chatComposerPillSurfaceClass)}>
        {approvals.length === 0 ? (
          <div className="px-4 py-3 text-[var(--vlaina-font-xs)] text-[var(--vlaina-sidebar-notes-text-soft)]">
            {t('settings.ai.computerPermissionsEmpty')}
          </div>
        ) : (
          <>
            <div className="max-h-[var(--vlaina-size-320px)] overflow-y-auto">
              {approvals.map((approval, index) => (
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-3 px-4 py-3',
                    index > 0 && 'border-t border-[var(--vlaina-border)]',
                  )}
                  key={approval.id}
                >
                  <div className="min-w-0 flex-1">
                    <code className="block break-all text-[var(--vlaina-font-xs)] text-[var(--vlaina-sidebar-notes-text)]">
                      {approval.command}
                    </code>
                    <div className="mt-1 break-all text-[var(--vlaina-font-11)] text-[var(--vlaina-sidebar-notes-text-soft)]">
                      {approval.cwd}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${t('common.remove')}: ${approval.command}`}
                    disabled={busyId !== null}
                    onClick={() => void revoke(approval.id)}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-[var(--vlaina-border)] px-4 py-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyId !== null}
                onClick={() => void clear()}
              >
                {t('settings.ai.clearComputerPermissions')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
