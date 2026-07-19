import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { raisedPillSurfaceClass } from '@/components/ui/surfaceStyles';
import { getAiMenuGroups } from './menuConfig';
import type { AiMenuGroup, AiMenuItem } from './types';
import { escapeToolbarHtml } from '../../htmlEscape';

const IS_MAC =
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function toPlatformShortcutLabel(shortcut: string): string {
  if (!IS_MAC) {
    return shortcut;
  }

  return shortcut
    .replace(/\bCtrl\b/g, '⌘')
    .replace(/\bControl\b/g, '⌘')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bOption\b/g, '⌥');
}

function buildItemIcon(icon?: 'quote'): string {
  if (icon === 'quote') {
    return `<span class="ai-dropdown-item-icon" aria-hidden="true">${EDITOR_ICONS.quote}</span>`;
  }

  return '';
}

function buildShortcutHint(item: AiMenuItem): string {
  if (!item.shortcut) {
    return '';
  }

  return `<span class="ai-dropdown-item-shortcut" aria-hidden="true">${escapeToolbarHtml(toPlatformShortcutLabel(item.shortcut))}</span>`;
}

function buildRootMarkup(groups: readonly AiMenuGroup[]): string {
  return `
    <div class="ai-dropdown-root !rounded-[var(--vlaina-notes-ui-radius-panel)] ${raisedPillSurfaceClass}">
      ${groups.map((group, index) => `
        ${group.rootAction ? `
          <button
            class="ai-dropdown-category ai-dropdown-category-action"
            data-ai-group-id="${group.id}"
            data-ai-behavior="${group.rootAction.behavior ?? 'review'}"
            data-ai-prompt="${escapeToolbarHtml(group.rootAction.instruction)}"
            data-ai-command-id="${escapeToolbarHtml(group.rootAction.id)}"
            data-ai-tone-id=""
            type="button"
            aria-label="${escapeToolbarHtml(group.rootAction.label)}"
          >
            ${buildItemIcon(group.rootAction.icon)}
            <span class="ai-dropdown-category-label">${escapeToolbarHtml(group.rootAction.label)}</span>
            ${buildShortcutHint(group.rootAction)}
          </button>
        ` : `
          <button
            class="ai-dropdown-category ${index === 0 ? 'active' : ''}"
            data-ai-category="${escapeToolbarHtml(group.id)}"
            type="button"
          >
            <span class="ai-dropdown-category-label">${escapeToolbarHtml(group.label)}</span>
            <span class="ai-dropdown-category-chevron" aria-hidden="true">›</span>
          </button>
        `}
      `).join('')}
    </div>
  `;
}

function buildItemsMarkup(group: AiMenuGroup): string {
  return `
    <div class="ai-dropdown-children !rounded-[var(--vlaina-notes-ui-radius-panel)] ${raisedPillSurfaceClass}" data-ai-category-panel="${escapeToolbarHtml(group.id)}">
      ${group.items.map((item) => `
        <button
          class="ai-dropdown-item"
          data-ai-group-id="${escapeToolbarHtml(group.id)}"
          data-ai-behavior="${item.behavior ?? 'review'}"
          data-ai-prompt="${escapeToolbarHtml(item.instruction)}"
          data-ai-command-id="${escapeToolbarHtml(item.id)}"
          data-ai-tone-id="${escapeToolbarHtml(group.tone ? item.id : '')}"
          type="button"
          aria-label="${escapeToolbarHtml(item.label)}"
        >
          ${buildItemIcon(item.icon)}
          <span class="ai-dropdown-item-label">${escapeToolbarHtml(item.label)}</span>
          ${buildShortcutHint(item)}
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
          data-ai-panel="${escapeToolbarHtml(group.id)}"
        >
          ${buildItemsMarkup(group)}
        </div>
      `).join('')}
    </div>
  `;
}
