import { useI18n, type MessageKey, type MessageValues } from '@/lib/i18n';
import { formatCnyEquivalent, renderRichText } from './aboutTabShared';

export function DeveloperNotePanel() {
  const { language, t } = useI18n();
  const catimeIncome = formatCnyEquivalent(language, 3000);
  const noteText = (key: MessageKey, values?: MessageValues) => renderRichText(t(key, values));

  return (
    <div className="min-w-0 rounded-[var(--vlaina-radius-24px)] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-glass)] p-5 shadow-[var(--vlaina-shadow-panel-soft)] max-[640px]:p-4">
      <div className="space-y-4 text-[var(--vlaina-font-sm)] leading-7 text-[var(--vlaina-sidebar-notes-text)]">
        <p className="text-[var(--vlaina-font-h4)] font-semibold leading-8 text-[var(--vlaina-sidebar-notes-text)]">
          {noteText('settings.about.note.intro')}
        </p>
        <p>{t('settings.about.note.curiousTitle')}</p>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--vlaina-font-sm)] leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          <li><strong>{t('settings.about.note.curiousMissing')}</strong></li>
          <li><strong>{t('settings.about.note.curiousRough')}</strong></li>
          <li><strong>{t('settings.about.note.curiousPaid')}</strong></li>
        </ol>
        <p>{t('settings.about.note.originStory')}</p>
        <p>{noteText('settings.about.note.migrationStory', { catimeSize: '200 KB', catimeStars: '4,000', targetSize: '20 MB' })}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.releaseHeading')}
        </h2>
        <p>{noteText('settings.about.note.releaseReason')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.donationHeading')}
        </h2>
        <p>{t('settings.about.note.donationReason')}</p>
        <p>{noteText('settings.about.note.catimeStory', { catimeStars: '4,000' })}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.earnHeading')}
        </h2>
        <p>{noteText('settings.about.note.catimeIncome', { catimeIncome })}</p>
        <p>{t('settings.about.note.graduated')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.jobHeading')}
        </h2>
        <p>{noteText('settings.about.note.jobStory')}</p>
        <p>{noteText('settings.about.note.afterWorkStory')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.weekendHeading')}
        </h2>
        <p>{t('settings.about.note.weekendStory')}</p>
        <p>{t('settings.about.note.resignationStory')}</p>
        <h3 className="text-[var(--vlaina-font-sm)] font-semibold leading-6 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.resignationQuoteHeading')}
        </h3>
        <div className="rounded-[var(--vlaina-radius-18px)] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-muted)] px-4 py-3 text-[var(--vlaina-font-13)] leading-6 text-[var(--vlaina-sidebar-notes-text-soft)]">
          <p className="mt-3 whitespace-pre-wrap">
            {noteText('settings.about.note.resignationQuote')}
          </p>
        </div>
        <p>{t('settings.about.note.newProject')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.paidHeading')}
        </h2>
        <p>{t('settings.about.note.paidAnswer')}</p>
        <p>{t('settings.about.note.valueAnswer')}</p>
        <p>{t('settings.about.note.supportMembership')}</p>
        <p>{t('settings.about.note.feedback')}</p>
        <p className="text-[var(--vlaina-color-brand-pink)]">
          {noteText('settings.about.note.thanks')}
        </p>
      </div>
    </div>
  );
}
