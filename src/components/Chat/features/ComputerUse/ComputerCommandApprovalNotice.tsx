import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  respondToComputerCommandApproval,
  usePendingComputerCommandApprovals,
  type ComputerCommandApprovalDecision,
} from '@/lib/ai/computerUse/approvalState';
import { useI18n } from '@/lib/i18n';
import { managedQuotaNoticeSurfaceClass } from '@/components/Chat/features/Input/components/ManagedQuotaNotice';

export function ComputerCommandApprovalNotice() {
  const { t } = useI18n();
  const approvals = usePendingComputerCommandApprovals();
  const approval = approvals[0];
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    setResponding(false);
  }, [approval?.id]);

  if (!approval) return null;

  const respond = async (decision: ComputerCommandApprovalDecision) => {
    if (responding) return;
    setResponding(true);
    try {
      const accepted = await respondToComputerCommandApproval(approval.id, decision);
      if (!accepted) setResponding(false);
    } catch {
      setResponding(false);
    }
  };

  return (
    <div
      data-computer-command-approval="true"
      aria-label={t('chat.computerUse')}
      className={managedQuotaNoticeSurfaceClass}
    >
      <Button
        type="button"
        size="sm"
        className="!rounded-[var(--vlaina-radius-pill)]"
        disabled={responding}
        onClick={() => void respond('run_once')}
      >
        {t('chat.computerUse.runOnce')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="!rounded-[var(--vlaina-radius-pill)]"
        disabled={responding || !approval.canAlwaysAllow}
        onClick={() => void respond('always')}
      >
        {t('chat.computerUse.alwaysRun')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="!rounded-[var(--vlaina-radius-pill)]"
        disabled={responding}
        onClick={() => void respond('cancel')}
      >
        {t('common.cancel')}
      </Button>
    </div>
  );
}
