import { getAiMenuGroups } from './menuConfig';
import type { AiMenuGroup } from './types';

function buildRootMarkup(groups: readonly AiMenuGroup[]): string {
  return `
    <div class="ai-dropdown-root">
      ${groups.map((group, index) => `
        <button
          class="ai-dropdown-category ${index === 0 ? 'active' : ''}"
          data-ai-category="${group.id}"
          type="button"
        >
          <span class="ai-dropdown-category-label">${group.label}</span>
          <span class="ai-dropdown-category-chevron" aria-hidden="true">›</span>
        </button>
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
          data-ai-prompt="${item.instruction}"
          data-ai-command-id="${item.id}"
          data-ai-tone-id="${group.tone ? item.id : ''}"
          type="button"
          aria-label="${item.label}"
        >
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
      ${groups.map((group, index) => `
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
