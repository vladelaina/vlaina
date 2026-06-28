import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';

export const selectClassName = 
  "px-2 py-1 pr-6 text-xs bg-[var(--vlaina-color-setting-field)] border border-[var(--vlaina-border)] rounded text-[var(--vlaina-sidebar-chat-text)] focus:outline-none focus:ring-1 focus:ring-[var(--vlaina-accent)] min-w-[var(--vlaina-size-100px)] cursor-pointer appearance-none bg-[length:var(--vlaina-settings-select-arrow-size)] bg-[position:var(--vlaina-settings-select-arrow-position)] bg-no-repeat";

export const settingsButtonClassName = 
  "px-3 py-1.5 text-xs font-medium text-[var(--vlaina-sidebar-chat-text)] bg-[var(--vlaina-bg-tertiary)] hover:bg-[var(--vlaina-hover)] rounded-md transition-colors";

export const settingsSelectedActionButtonClassName =
  "inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--vlaina-sidebar-row-selected-bg)] px-4 text-[var(--vlaina-font-13)] font-[var(--vlaina-font-weight-semibold-plus)] text-[var(--vlaina-sidebar-row-selected-text)] shadow-[var(--vlaina-shadow-selection-soft)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)] hover:text-[var(--vlaina-sidebar-row-selected-text)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-60)]";

export const settingsPillDropdownContentClassName = cn(
  "z-[var(--vlaina-z-120)] rounded-[var(--vlaina-radius-22px)] p-1.5",
  chatComposerPillSurfaceClass
);

export const settingsPillDropdownItemClassName =
  "flex h-8 min-w-0 rounded-full px-3 py-0 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] outline-none transition-[background-color,box-shadow,color] hover:bg-[var(--vlaina-accent-light)] hover:text-[var(--vlaina-accent)] focus:bg-[var(--vlaina-accent-light)] focus:text-[var(--vlaina-accent)] data-[highlighted]:bg-[var(--vlaina-accent-light)] data-[highlighted]:text-[var(--vlaina-accent)]";

export const settingsPillDropdownItemSelectedClassName =
  "bg-[var(--vlaina-accent-light)] text-[var(--vlaina-accent)] shadow-[var(--vlaina-shadow-selection-soft)] data-[highlighted]:bg-[var(--vlaina-accent-light)] data-[highlighted]:text-[var(--vlaina-accent)]";
