import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useNotesOutline } from '../Sidebar/Outline/useNotesOutline';

export function EditorOutlineRail({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const { headings, activeId, jumpToHeading } = useNotesOutline(enabled);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      activeRowRef.current?.scrollIntoView?.({ block: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeId]);

  if (!enabled || headings.length === 0) {
    return null;
  }

  return (
    <aside
      className="editor-outline-rail"
      data-editor-outline-rail="true"
      data-no-editor-drag-box="true"
    >
      <div className="editor-outline-header" aria-hidden="true">
        <Icon name="editor.toc" size="xs" className="editor-outline-header-icon" />
        <span className="editor-outline-header-text">{t('notes.documentOutline')}</span>
      </div>
      <nav
        className="editor-outline-list"
        aria-label={t('notes.documentOutline')}
      >
        {headings.map((heading) => (
          <button
            key={heading.id}
            ref={heading.id === activeId ? activeRowRef : undefined}
            type="button"
            className={cn(
              'editor-outline-row',
              heading.id === activeId && 'editor-outline-row-active',
            )}
            data-level={heading.level}
            aria-current={heading.id === activeId ? 'location' : undefined}
            onClick={() => jumpToHeading(heading.id)}
          >
            <span className="editor-outline-row-text">{heading.text}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
