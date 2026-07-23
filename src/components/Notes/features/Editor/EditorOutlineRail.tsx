import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useNotesOutline } from '../Sidebar/Outline/useNotesOutline';

export function EditorOutlineRail({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const { headings, activeId, jumpToHeading } = useNotesOutline(enabled);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const outlineId = useId();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      activeRowRef.current?.scrollIntoView?.({ block: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeId, isCollapsed]);

  if (!enabled || headings.length === 0) {
    return null;
  }

  return (
    <aside
      className={cn('editor-outline-rail', isCollapsed && 'editor-outline-rail-collapsed')}
      data-editor-outline-rail="true"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      data-no-editor-drag-box="true"
    >
      <button
        type="button"
        className="editor-outline-header"
        aria-label={t('notes.documentOutline')}
        aria-controls={outlineId}
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((previous) => !previous)}
      >
        <Icon name="editor.toc" size="xs" className="editor-outline-header-icon" />
        <span className="editor-outline-header-text">{t('notes.documentOutline')}</span>
        <Icon
          name={isCollapsed ? 'nav.chevronLeft' : 'nav.chevronRight'}
          size="xs"
          className="editor-outline-header-toggle"
        />
      </button>
      <nav
        id={outlineId}
        className="editor-outline-list"
        aria-label={t('notes.documentOutline')}
        aria-hidden={isCollapsed}
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
