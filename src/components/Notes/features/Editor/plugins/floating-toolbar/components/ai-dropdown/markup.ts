import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { getAiMenuGroups } from './menuConfig';
import type { AiMenuGroup } from './types';

function buildItemIcon(icon?: 'quote'): string {
  if (icon === 'quote') {
    return `<span class="ai-dropdown-item-icon" aria-hidden="true">${EDITOR_ICONS.quote}</span>`;
  }

  return '';
}

function buildRootMarkup(groups: readonly AiMenuGroup[]): string {
  return `
    <div class="ai-dropdown-root">
      ${groups.map((group, index) => `
        ${group.rootAction ? `
          <button
            class="ai-dropdown-category ai-dropdown-category-action"
            data-ai-group-id="${group.id}"
            data-ai-behavior="${group.rootAction.behavior ?? 'review'}"
            data-ai-prompt="${group.rootAction.instruction}"
            data-ai-command-id="${group.rootAction.id}"
            data-ai-tone-id=""
            type="button"
            aria-label="${group.rootAction.label}"
          >
            ${buildItemIcon(group.rootAction.icon)}
            <span class="ai-dropdown-category-label">${group.rootAction.label}</span>
          </button>
        ` : `
          <button
            class="ai-dropdown-category ${index === 0 ? 'active' : ''}"
            data-ai-category="${group.id}"
            type="button"
          >
            <span class="ai-dropdown-category-label">${group.label}</span>
            <span class="ai-dropdown-category-chevron" aria-hidden="true">›</span>
          </button>
        `}
      `).join('')}
    </div>
  `;
}

function buildItemsMarkup(group: AiMenuGroup): string {
  return `
    <div class="ai-dropdown-children" data-ai-category-panel="${group.id}">
      ${group.items.map((item) => `
        <button
          class="ai-dropdown-item"
          data-ai-group-id="${group.id}"
          data-ai-behavior="${item.behavior ?? 'review'}"
          data-ai-prompt="${item.instruction}"
          data-ai-command-id="${item.id}"
          data-ai-tone-id="${group.tone ? item.id : ''}"
          type="button"
          aria-label="${item.label}"
        >
          ${buildItemIcon(item.icon)}
          <span class="ai-dropdown-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

export function createAiDropdownMarkup(): string {
  const groups = getAiMenuGroups();

  return `
    ${buildRootMarkup(groups)}
    <div class="ai-dropdown-panels">
      ${groups.filter((group) => !group.rootAction).map((group, index) => `
        <div
          class="ai-dropdown-panel ${index === 0 ? 'active' : ''}"
          data-ai-panel="${group.id}"
        >
          ${buildItemsMarkup(group)}
        </div>
      `).join('')}
    </div>
  `;
}
