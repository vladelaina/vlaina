# Contributing to NekoTick

## Comments
- English only
- Keep minimal

## UI Guidelines
- **Icons & Buttons**: Use centralized styles from `@/lib/utils`.
  - Use `iconButtonStyles` for standard ghost buttons (icon-only, clear background, dark-on-hover).
  - Do NOT re-implement button styles in individual components.
- **Tooltips**: Use the standard `Tooltip` component from `@/components/ui/tooltip`.
  - Style: Black background (`bg-foreground`), White text (`text-background`).
  - Do NOT create custom tooltip implementations.