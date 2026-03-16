# Repository Notes

## Milkdown Ownership

This repository vendors Milkdown under `vendor/milkdown` and resolves the editor's main Milkdown packages from the local workspace, not from npm-published upstream packages.

Current locally owned workspace-linked Milkdown packages:

- `@milkdown/kit`
- `@milkdown/plugin-block`
- `@milkdown/plugin-slash`
- `@milkdown/react`
- `@milkdown/theme-nord`

The workspace wiring is defined in `pnpm-workspace.yaml`, and the app dependency declarations use `workspace:*` where applicable.

## Editing Guidance

When changing editor core behavior, prefer modifying `vendor/milkdown/...` first instead of adding app-level workarounds in `src/...`.

Do not assume npm upstream Milkdown source matches runtime behavior in this repo.

If behavior differs from public Milkdown docs or npm package contents, trust the vendored source in `vendor/milkdown`.

## Coding Style

Comments strategy: zero-comment default.

- Do not write comments unless the logic is a non-standard workaround, a specific bug hack, or unusually complex logic that cannot be made self-explanatory through naming.
- Never add comments that only restate what the code already does.
- Keep comments brand-neutral.
- Prefer refactoring over commenting.

## Complexity Guardrails

Before adding code, check whether the target function or file is already too complex.

- Be cautious once a function is around 50 lines.
- Be cautious once a file is around 300 lines or already feels cluttered.
- Be cautious once nesting exceeds 3 to 4 levels.

If a change would push the file or function into obvious over-complexity, prefer extracting new modules first instead of appending more logic into place.

When splitting a file, prefer keeping the original file in place until the replacement structure is fully wired.

Magic phrase: `Refactor This`

- If the user says this, prioritize reducing complexity and improving structure over feature work.

## Communication Rules

- Code identifiers, comments, commit messages, branch names, and code-facing docs must be English-only.
- Chat responses should mirror the user's language.
- Do not create summary markdown files just to explain your work unless the user explicitly asks for a documentation file or the file is part of the product structure.
- Remove temporary debug code and diagnostic artifacts after the issue is resolved unless the user asks to keep them.

## Commit Message Rules

- Use the format `<emoji><type>(<optional-scope>): <summary>`.
- Example: `🐛fix(editor): resolve markdown paste ambiguity`.
- Do not use plain commit subjects when a typed keyword format is expected.
- Keep commit messages in English-only.

Preferred commit types:

- `✨feat`: add a new feature or module
- `🐛fix`: fix a bug or defect
- `📚docs`: documentation-only changes
- `💅style`: formatting-only changes with no logic impact
- `♻️refactor`: structural refactor without feature or bug changes
- `🗑️remove`: remove code, features, or modules
- `⚡perf`: performance improvements
- `✅test`: add or update tests
- `🏗️build`: build tooling or packaging changes
- `🤖ci`: CI configuration changes
- `🔧chore`: maintenance or miscellaneous non-feature work
- `⏪revert`: revert a previous change
- `🔀merge`: merge commit
- `🚧wip`: work in progress
- `🕒temp`: temporary checkpoint commit
- `🎉init`: initial project setup
- `📦deps`: dependency changes
- `⚙️config`: configuration changes
- `🚀release`: release preparation or release commit
- `🩹hotfix`: urgent production fix
- `⬆️upgrade`: version or capability upgrade
- `⬇️downgrade`: version downgrade
- `🔒security`: security fix
- `🧹lint`: lint-only changes
- `🧠ux`: user experience improvement
- `🌐i18n`: internationalization changes
- `♿a11y`: accessibility improvements
- `✏️typo`: spelling or wording fixes
- `📈log`: logging changes
- `🎨ui`: UI polish or visual changes
- `🔌api`: API-related changes
- `🧪mock`: mock data changes
- `🌱env`: environment variable changes

## UI Standards

### Icons

Always use the central `Icon` component. Do not import icon libraries directly in feature code.

```tsx
import { Icon } from '@/components/ui/icons';

<Icon name="common.add" size="md" />
```

Use preset sizes for consistency:

- `xs`
- `sm`
- `md`
- `lg`
- `xl`

All functional and decorative icons should target a 20px standard.

- Use `size="md"` or `size={20}` when supported.
- Use `size-[20px]` or `w-[20px] h-[20px]` when raw classes are needed.

Adding new icons:

1. Import the icon in `src/components/ui/icons/registry.ts`.
2. Add it to the registry with a semantic name.

Naming conventions:

- `common.*`: global actions
- `nav.*`: navigation
- `file.*`: files and folders
- `sidebar.*`: app module icons
- `theme.*`: appearance modes

Do not use the `ai.*` namespace. It is deprecated. Use `common.*` or a descriptive domain namespace instead.

Delete and trash actions must use `@/components/common/DeleteIcon`.

### Buttons And Shortcut Hints

- Use `iconButtonStyles` from `@/lib/utils` for standard borderless icon buttons.
- Use `ShortcutKeys` from `@/components/ui/shortcut-keys` for compact shortcut hint rendering.
- Do not hand-roll compact `<kbd>` styles in feature code for this pattern.

## Output Completeness

- Do not use placeholder fragments like `... existing code ...` in implementation output unless the user explicitly asked for a summary or diff-only style response.
- When modifying a large area, provide complete working code for the changed unit.

## Git Sync Constraint

Because data is synced through GitHub, avoid storing unbounded data in a single large file.

- Split potentially unbounded data across smaller files.
- Prefer one-file-per-session or similarly bounded storage strategies.

## Editor Hardening History

Historical checklist consolidated from `docs/editor-hardening-checklist.md`.

Last updated: 2026-03-04 (Asia/Shanghai)

Completed baseline and hardening milestones:

- Baseline recorded for `tsc`, `vitest`, `build`, unresolved font warnings, and chunk sizes.
- Paste and cursor regression tests were restored and verified.
- Font warning elimination was completed by moving KaTeX and `@fontsource/*` imports out of CSS `@import` and into JS-side imports.
- Chunk size reduction was completed through targeted lazy loading and bundle splitting.
- A permanent quality gate was added via:
  - `scripts/quality-gate.mjs`
  - `scripts/check-build-budget.mjs`
  - `package.json` scripts such as `quality:verify`, `quality:budget`, and `quality:gate`

Recorded evidence from that effort:

- Baseline `vitest`: `29 files / 231 tests` pass
- Hardened full suite: `31 files / 256 tests` pass
- Baseline main chunk: `3,791.83 kB`
- Final main chunk after hardening: `585.06 kB`
- Final unresolved font warnings: `0`

If future work touches paste reliability, cursor behavior, font imports, or build-size regressions, treat those historical targets as existing expectations rather than starting from zero.
