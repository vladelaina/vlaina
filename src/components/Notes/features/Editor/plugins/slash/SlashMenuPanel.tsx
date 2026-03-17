import type { SlashMenuItem } from './types';
import { groupSlashItems } from './slashQuery';

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
  const groups = groupSlashItems(items);
  let itemIndex = 0;

  return (
    <div className="slash-menu-panel" role="listbox" aria-label="Insert block">
      {Array.from(groups.entries()).map(([groupName, groupItems]) => (
        <div key={groupName} className="slash-menu-group">
          <div className="slash-menu-group-title">{groupName}</div>
          {groupItems.map((item) => {
            const index = itemIndex;
            itemIndex += 1;
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
                  {item.description ? (
                    <span className="slash-menu-item-desc">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
