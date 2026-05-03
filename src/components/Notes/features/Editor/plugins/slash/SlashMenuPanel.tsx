import type { SlashMenuItem } from './types';

type SlashMenuPanelProps = {
  items: readonly SlashMenuItem[];
  selectedIndex: number;
  onHoverItem: (index: number) => void;
  onSelectItem: (index: number) => void;
};

export function SlashMenuPanel({
  items,
  selectedIndex,
  onHoverItem,
  onSelectItem,
}: SlashMenuPanelProps) {
  return (
    <div className="slash-menu-panel" role="listbox" aria-label="Insert block">
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
            onMouseEnter={() => onHoverItem(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelectItem(index);
            }}
          >
            <span className="slash-menu-item-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="slash-menu-item-content">
              <span className="slash-menu-item-name">{item.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
