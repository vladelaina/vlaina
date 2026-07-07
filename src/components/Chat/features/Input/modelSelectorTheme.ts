import type { ModelSelectorTheme, ModelSelectorThemeStyles } from './modelSelectorTypes'

export const MODEL_SELECTOR_THEME_STYLES: Record<ModelSelectorTheme, ModelSelectorThemeStyles> = {
  chat: {
    triggerHover: 'hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]',
    triggerText: 'text-[var(--vlaina-sidebar-chat-text-muted)]',
    triggerTextActive: 'text-[var(--vlaina-sidebar-chat-text)]',
    sectionLabel: 'text-[var(--vlaina-sidebar-chat-text-soft)]',
    divider: 'border-[var(--vlaina-color-model-selector-divider)]',
    inputText: 'text-[var(--vlaina-sidebar-chat-text)]',
    inputPlaceholder: 'placeholder:text-[var(--vlaina-sidebar-chat-text-soft)]',
    settingsButton: 'text-[var(--vlaina-sidebar-chat-text)]',
    categoryHover: 'hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]',
    optionText: 'text-[var(--vlaina-sidebar-chat-text)]',
    optionTextActive: 'text-[var(--vlaina-sidebar-row-selected-text)]',
    emptyText: 'text-[var(--vlaina-sidebar-chat-text-soft)]',
  },
  notes: {
    triggerHover: 'hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]',
    triggerText: 'text-[var(--vlaina-sidebar-notes-text-muted)]',
    triggerTextActive: 'text-[var(--vlaina-sidebar-notes-text)]',
    sectionLabel: 'text-[var(--vlaina-sidebar-notes-text-soft)]',
    divider: 'border-[var(--vlaina-color-model-selector-divider)]',
    inputText: 'text-[var(--vlaina-sidebar-notes-text)]',
    inputPlaceholder: 'placeholder:text-[var(--vlaina-sidebar-notes-text-soft)]',
    settingsButton: 'text-[var(--vlaina-sidebar-notes-text)]',
    categoryHover: 'hover:bg-transparent hover:text-[var(--vlaina-sidebar-row-selected-text)]',
    optionText: 'text-[var(--vlaina-sidebar-notes-text)]',
    optionTextActive: 'text-[var(--vlaina-sidebar-row-selected-text)]',
    emptyText: 'text-[var(--vlaina-sidebar-notes-text-soft)]',
  },
}
