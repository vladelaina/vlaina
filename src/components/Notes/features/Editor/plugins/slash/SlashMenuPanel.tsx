import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import type { SlashMenuItem } from './types';
import { themeIconTokens } from '@/styles/themeTokens';

type SlashMenuPanelProps = {
  items: readonly SlashMenuItem[];
  selectedIndex: number;
  onHoverItem: (index: number, pointer: { clientX: number; clientY: number }) => void;
  onSelectItem: (index: number) => void;
};

export function SlashMenuPanel({
  items,
  selectedIndex,
  onHoverItem,
  onSelectItem,
}: SlashMenuPanelProps) {
  const { t } = useI18n();

  return (
    <div className="slash-menu-panel" role="listbox" aria-label={t('editor.insertBlock')}>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={item.id}
            type="button"
            className={`slash-menu-item${isSelected ? ' selected' : ''}`}
            data-index={index}
            aria-selected={isSelected}
            role="option"
            onMouseMove={(event) => onHoverItem(index, {
              clientX: event.clientX,
              clientY: event.clientY,
            })}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelectItem(index);
            }}
          >
            <span className="slash-menu-item-icon" aria-hidden="true">
              <Icon name={item.icon} size={themeIconTokens.sizeCompact} />
            </span>
            <span className="slash-menu-item-content">
              <span className="slash-menu-item-name">{t(item.nameKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
