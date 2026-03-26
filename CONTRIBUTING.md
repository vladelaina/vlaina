# Contributing to vlaina

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

## Testing Structure
- Unit/component tests should stay close to implementation files under `src/**` using `*.test.ts` / `*.test.tsx`.
- Cross-module integration tests should live under `test/integration/**`.
- End-to-end style tests/scripts should live under `test/e2e/**`.
